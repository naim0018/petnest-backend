import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CookieUtil } from 'src/common/utils/cookie.util';
import { extractVisitorInfo } from 'src/common/utils/Visitor-info.util';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  async login(
    @Body() payload: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { ip, deviceInfo } = extractVisitorInfo(req);

    const { tokens, user } = await this.authService.login(
      payload,
      ip,
      deviceInfo,
    );
    CookieUtil.setAuthCookies(
      res,
      tokens.accessToken,
      tokens.refreshToken,
      Boolean(payload.rememberMe),
    );
    return {
      ...user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const authHeader = req.headers?.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const accessToken =
      (typeof req.cookies?.accessToken === 'string'
        ? req.cookies.accessToken
        : undefined) || bearerToken;
    const refreshToken =
      typeof req.cookies?.refreshToken === 'string'
        ? req.cookies.refreshToken
        : undefined;

    await this.authService.logout(accessToken, refreshToken);
    CookieUtil.clearAuthCookies(res);
    return {
      message: 'User logged out successfully',
    };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body() payload: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { ip, deviceInfo } = extractVisitorInfo(req);
    const { tokens, user } = await this.authService.register(
      payload,
      ip,
      deviceInfo,
    );
    CookieUtil.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  @Post('refresh-token')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh token' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authHeader = req.headers?.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const refreshToken =
      (typeof req.cookies?.refreshToken === 'string'
        ? req.cookies.refreshToken
        : undefined) || bearerToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { tokens, rememberMe } = await this.authService.refreshToken(refreshToken);
    CookieUtil.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, rememberMe);
    return {
      message: 'Tokens refreshed successfully',
    };
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forgot Password' })
  async forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset Password' })
  async resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  // ========================================================
  // GOOGLE OAUTH ENDPOINTS
  // ========================================================

  @Get('oauth/status')
  @ApiOperation({ summary: 'Check public OAuth configuration status' })
  async getOAuthStatus() {
    return this.authService.getOAuthStatus();
  }

  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth2 authentication flow' })
  async googleAuth(@Res() res: Response) {
    const authUrl = await this.authService.getGoogleAuthUrl();
    return res.redirect(authUrl);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth2 callback redirect handler' })
  async googleAuthCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl =
      process.env.FRONTEND_URL?.trim().replace(/\/$/, '') || 'http://localhost:3000';

    if (error || !code) {
      const errorParam = encodeURIComponent(error || 'AccessDenied');
      return res.redirect(`${frontendUrl}/auth/login?error=${errorParam}`);
    }

    try {
      const { ip, deviceInfo } = extractVisitorInfo(req);
      const { tokens } = await this.authService.handleGoogleCallback(
        code,
        ip,
        deviceInfo,
      );

      CookieUtil.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, true);
      return res.redirect(`${frontendUrl}/auth/callback?success=true`);
    } catch (err: any) {
      console.error('Google OAuth callback failed:', err.message);
      const errMessage = encodeURIComponent(err.message || 'AuthenticationFailed');
      return res.redirect(`${frontendUrl}/auth/login?error=${errMessage}`);
    }
  }
}
