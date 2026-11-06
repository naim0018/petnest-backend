import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthenticatedUser } from './jwt-auth.guard';

/**
 * Attaches `req.user` (with live DB role) if a valid accessToken + active session
 * is present; otherwise proceeds anonymously without throwing 401.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
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
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
        { secret: this.jwtSecret },
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

      if (session?.user) {
        request['user'] = {
          userId: session.user.id,
          role: session.user.role,
          sessionId: session.id,
        };
      }
    } catch {
      // Ignore expired/invalid tokens on public endpoints
    }

    return true;
  }

  private extractToken(req: Request): string | null {
    if (
      typeof req.cookies?.accessToken === 'string' &&
      req.cookies.accessToken
    ) {
      return req.cookies.accessToken;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}
