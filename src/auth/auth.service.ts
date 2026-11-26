import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/settings/settings.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface TokenPayload {
  userId: string;
  role: string;
  sessionId: string;
  jti?: string;
}

@Injectable()
export class AuthService {
  private readonly saltRounds: number;
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {
    this.saltRounds =
      Number(this.configService.get('BCRYPT_SALT_ROUNDS')) || 10;
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.jwtRefreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  async register(payload: RegisterDto, ip: string, deviceInfo: any) {
    const { name, email, password, phone, interestedBreed, interestedSpecies } =
      payload;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    if (interestedSpecies) {
      const speciesExists = await this.prisma.petSpecies.findUnique({
        where: { id: interestedSpecies },
      });
      if (!speciesExists) {
        throw new BadRequestException(
          'Selected interested species does not exist',
        );
      }
    }

    if (interestedBreed) {
      const breedExists = await this.prisma.petBreed.findUnique({
        where: { id: interestedBreed },
      });
      if (!breedExists) {
        throw new BadRequestException(
          'Selected interested breed does not exist',
        );
      }

      if (interestedSpecies && breedExists.speciesId !== interestedSpecies) {
        throw new BadRequestException(
          'Selected breed does not belong to the selected species',
        );
      }
    }

    try {
      const newUser = await this.prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          interestedSpeciesId: interestedSpecies || null,
          interestedBreedId: interestedBreed || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          interestedSpeciesId: true,
          interestedBreedId: true,
          interestedSpecies: true,
          interestedBreed: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const tokens = await this.createSessionAndTokens(
        newUser.id,
        newUser.role,
        ip,
        deviceInfo,
      );
      return { user: newUser, tokens };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('User already exists');
      }
      console.error('Error while registering user:', error?.message || error);
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async login(payload: LoginDto, ip: string, deviceInfo: any) {
    const { email, password } = payload;
    const identifier = email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { email: `${identifier}@gmail.com` },
          { name: { equals: email.trim(), mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'This account was registered using Google Sign-In. Please sign in with Google.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const tokens = await this.createSessionAndTokens(
      user.id,
      user.role,
      ip,
      deviceInfo,
      Boolean(payload.rememberMe),
    );

    return {
      tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(accessToken?: string, refreshToken?: string) {
    const verified = await this.verifyAnyAuthToken(accessToken, refreshToken);
    if (verified?.sessionId && verified?.userId) {
      await this.prisma.session.updateMany({
        where: {
          id: verified.sessionId,
          userId: verified.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        revokedAt: null,
      },
      include: {
        user: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session || !session.user) {
      throw new UnauthorizedException('Session is invalid or has been revoked');
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Constant-time SHA-256 verification across the full JWT (avoids bcrypt 72-byte truncation)
    const isValid = CryptoUtil.verifySha256(refreshToken, session.hashToken);
    if (!isValid) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if original session was configured for 30 days (rememberMe)
    const wasRememberMe =
      session.expiresAt.getTime() - session.createdAt.getTime() >
      14 * 24 * 60 * 60 * 1000;

    const tokens = await this.rotateSessionTokens(
      session.id,
      session.user.id,
      session.user.role,
      wasRememberMe,
    );

    return {
      tokens,
      rememberMe: wasRememberMe,
    };
  }

  async forgotPassword(payload: ForgotPasswordDto) {
    const genericMessage =
      'If an account exists with this email, a password reset link has been sent.';

    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      return { message: genericMessage };
    }

    const { rawToken, hashedToken } = CryptoUtil.generateRandomToken(32);
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: tokenExpiry,
      },
    });

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.FRONTENDURL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    const _resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    // TODO: Send `_resetUrl` via email service (e.g. Resend / Nodemailer)

    return { message: genericMessage };
  }

  async resetPassword(payload: ResetPasswordDto) {
    const { token, newPassword } = payload;

    const hashedToken = CryptoUtil.hashSha256(token);

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return {
      message: 'Password has been reset successfully. Please log in.',
    };
  }

  private async verifyAnyAuthToken(
    accessToken?: string,
    refreshToken?: string,
  ): Promise<TokenPayload | null> {
    if (accessToken) {
      try {
        return await this.jwtService.verifyAsync<TokenPayload>(accessToken, {
          secret: this.jwtSecret,
        });
      } catch {
        // Access token may be expired; fall through to try refresh token
      }
    }

    if (refreshToken) {
      try {
        return await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
          secret: this.jwtRefreshSecret,
        });
      } catch {
        return null;
      }
    }

    return null;
  }

  private async createSessionAndTokens(
    userId: string,
    role: string,
    ip: string,
    deviceInfo: any,
    rememberMe = false,
  ) {
    const sessionId = randomUUID();
    const tokens = await this.generateTokens(userId, role, sessionId, rememberMe);
    const hashedRefreshToken = CryptoUtil.hashSha256(tokens.refreshToken);
    const sessionDurationMs = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 1 * 24 * 60 * 60 * 1000;  // 1 day session

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        hashToken: hashedRefreshToken,
        deviceInfo,
        ipAddress: ip,
        expiresAt: new Date(Date.now() + sessionDurationMs),
      },
    });

    return tokens;
  }

  private async rotateSessionTokens(
    sessionId: string,
    userId: string,
    role: string,
    rememberMe = false,
  ) {
    const tokens = await this.generateTokens(userId, role, sessionId, rememberMe);
    const hashedRefreshToken = CryptoUtil.hashSha256(tokens.refreshToken);
    const sessionDurationMs = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 1 * 24 * 60 * 60 * 1000;  // 1 day session

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        hashToken: hashedRefreshToken,
        expiresAt: new Date(Date.now() + sessionDurationMs),
      },
    });

    return tokens;
  }

  private async generateTokens(
    userId: string,
    role: string,
    sessionId: string,
    rememberMe = false,
  ) {
    const accessPayload: TokenPayload = {
      userId,
      role,
      sessionId,
      jti: randomUUID(),
    };
    const refreshPayload: TokenPayload = {
      userId,
      role,
      sessionId,
      jti: randomUUID(),
    };

    const refreshExpiresIn = rememberMe ? '30d' : '1d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.jwtSecret,
        expiresIn: '1h',
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.jwtRefreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // ========================================================
  // GOOGLE OAUTH FLOW METHODS
  // ========================================================

  async getOAuthStatus(): Promise<{ googleEnabled: boolean }> {
    const config = await this.settingsService.getResolvedGoogleOAuth();
    return { googleEnabled: config.isEnabled };
  }

  async getGoogleAuthUrl(): Promise<string> {
    const config = await this.settingsService.getResolvedGoogleOAuth();
    if (!config.isEnabled || !config.clientId) {
      throw new BadRequestException(
        'Google Sign-In is not configured or currently disabled by administrator.',
      );
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(
    code: string,
    ip: string,
    deviceInfo: any,
  ): Promise<{ tokens: { accessToken: string; refreshToken: string }; user: any }> {
    const config = await this.settingsService.getResolvedGoogleOAuth();
    if (!config.clientId || !config.clientSecret) {
      throw new BadRequestException('Google OAuth is not configured on server.');
    }

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange error:', tokenData);
      throw new UnauthorizedException(
        tokenData?.error_description || 'Failed to exchange Google authorization code.',
      );
    }

    // 2. Fetch User Profile using Google access token
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profileData = await profileRes.json();
    if (!profileRes.ok || !profileData.email) {
      console.error('Google userinfo error:', profileData);
      throw new UnauthorizedException('Failed to retrieve user profile from Google.');
    }

    const googleId = String(profileData.sub);
    const email = String(profileData.email).trim().toLowerCase();
    const name = profileData.name?.trim() || email.split('@')[0];
    const picture = profileData.picture || null;

    // 3. Find or Create User
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
      include: { profile: true },
    });

    if (user) {
      // User exists - link googleId if not linked yet
      const updates: any = {};
      if (!user.googleId) {
        updates.googleId = googleId;
      }
      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updates,
          include: { profile: true },
        });
      }

      if (picture && user.profile && !user.profile.avatar) {
        await this.prisma.profile.update({
          where: { userId: user.id },
          data: { avatar: picture },
        });
      }
    } else {
      // Create new user with standard USER role and imported avatar
      user = await this.prisma.user.create({
        data: {
          name,
          email,
          googleId,
          role: 'USER',
          profile: {
            create: {
              avatar: picture,
              city: 'Unknown',
              country: 'Unknown',
            },
          },
        },
        include: { profile: true },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate with Google.');
    }

    if (user.isBanned) {
      throw new UnauthorizedException(
        user.bannedReason || 'Your account has been suspended. Please contact support.',
      );
    }

    // 4. Create Session and Tokens (rememberMe = true for OAuth)
    const tokens = await this.createSessionAndTokens(
      user.id,
      user.role,
      ip,
      deviceInfo,
      true,
    );

    return {
      tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: picture || user.profile?.avatar || null,
      },
    };
  }
}
