import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { UUID_REGEX } from '../utils/validation.util';
import { extractVisitorInfo } from '../utils/Visitor-info.util';

@Injectable()
export class VisitorTracingMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip preflight requests, static assets, favicon, and Swagger docs
    if (
      req.method === 'OPTIONS' ||
      req.path.startsWith('/public') ||
      req.path.startsWith('/api') ||
      req.path === '/favicon.ico'
    ) {
      return next();
    }

    const rawVisitorHeader = req.headers['x-visitor-id'];
    const candidateId =
      (typeof rawVisitorHeader === 'string' ? rawVisitorHeader.trim() : undefined) ||
      (typeof req.cookies?.['visitor_id'] === 'string'
        ? req.cookies['visitor_id'].trim()
        : undefined);

    let visitorId =
      candidateId && UUID_REGEX.test(candidateId) ? candidateId : undefined;

    if (!visitorId) {
      visitorId = randomUUID();

      res.cookie('visitor_id', visitorId, {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    req['visitorId'] = visitorId;

    const info = extractVisitorInfo(req);
    const country = info.country || 'Unknown';
    const city = info.city || 'Unknown';
    const timezone = info.timezone || 'UTC';
    const safePath = (req.originalUrl || req.path).slice(0, 500);

    this.prisma.visitor
      .upsert({
        where: { id: visitorId },
        update: {
          lastSeenAt: new Date(),
          ipAddress: info.ip,
          country,
          city,
          timezone,
          deviceInfo: info.deviceInfo as any,
          totalVisits: { increment: 1 },
        },
        create: {
          id: visitorId,
          ipAddress: info.ip,
          deviceInfo: info.deviceInfo as any,
          country,
          city,
          timezone,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      })
      .then(() => {
        return this.prisma.pageView.create({
          data: {
            visitorId,
            path: safePath,
          },
        });
      })
      .catch((err) => {
        console.error('Visitor tracking error:', err.message);
      });

    next();
  }
}
