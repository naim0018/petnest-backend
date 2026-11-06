import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  role: string;
  sessionId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
        {
          secret: this.jwtSecret,
        },
      );

      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sessionId,
          userId: payload.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: { id: true, role: true },
          },
        },
      });

      if (!session || !session.user) {
        throw new UnauthorizedException('Session revoked or expired');
      }

      // Always attach live role from database so role demotions take effect immediately
      request['user'] = {
        userId: session.user.id,
        role: session.user.role,
        sessionId: session.id,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractToken(req: Request): string | null {
    if (typeof req.cookies?.accessToken === 'string' && req.cookies.accessToken) {
      return req.cookies.accessToken;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return null;
  }
}
