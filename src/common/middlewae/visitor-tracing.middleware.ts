import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { UUID_REGEX } from '../utils/validation.util';
import { extractVisitorInfo } from '../utils/Visitor-info.util';

const BOT_PATTERNS = [
  'bot',
  'crawl',
  'spider',
  'slurp',
  'mediapartners',
  'lighthouse',
  'node-fetch',
  'axios',
  'curl',
  'wget',
  'postman',
  'docker',
  'kube-probe',
  'health',
  'insomnia',
  'python',
  'headlesschrome',
];

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity window
const PAGEVIEW_DEDUP_MS = 2 * 60 * 1000; // 2 minutes debounce for identical pageview

@Injectable()
export class VisitorTracingMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path || '';

    // 1. Skip system pings, health checks, preflight requests, docs, and assets
    if (
      req.method === 'OPTIONS' ||
      req.method === 'HEAD' ||
      path === '/' ||
      path === '/health' ||
      path === '/favicon.ico' ||
      path.startsWith('/public') ||
      path.startsWith('/docs') ||
      path.startsWith('/swagger') ||
      path.startsWith('/graphql')
    ) {
      return next();
    }

    // 2. Filter automated bots, crawlers, and server-side probes
    const rawUa = req.headers['user-agent'];
    if (!rawUa || typeof rawUa !== 'string' || rawUa.trim() === '') {
      return next();
    }
    const uaLower = rawUa.toLowerCase();
    if (BOT_PATTERNS.some((pattern) => uaLower.includes(pattern))) {
      return next();
    }

    // 3. Resolve visitor identifier (Header > Cookie)
    const rawVisitorHeader = req.headers['x-visitor-id'];
    const candidateHeader =
      typeof rawVisitorHeader === 'string' ? rawVisitorHeader.trim() : undefined;

    // Skip server-side rendering internal calls
    if (candidateHeader === 'ssr') {
      return next();
    }

    const candidateCookie =
      typeof req.cookies?.['visitor_id'] === 'string'
        ? req.cookies['visitor_id'].trim()
        : undefined;

    const validHeaderId =
      candidateHeader && UUID_REGEX.test(candidateHeader)
        ? candidateHeader
        : undefined;
    const validCookieId =
      candidateCookie && UUID_REGEX.test(candidateCookie)
        ? candidateCookie
        : undefined;

    let visitorId = validHeaderId || validCookieId;

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

    // 4. Extract geographic and device metadata
    const info = extractVisitorInfo(req);
    const country = info.country || 'Unknown';
    const city = info.city || 'Unknown';
    const timezone = info.timezone || 'UTC';
    const now = new Date();

    // 5. Track visitor session (30-minute inactivity window for new session)
    try {
      const existing = await this.prisma.visitor.findUnique({
        where: { id: visitorId },
        select: { lastSeenAt: true },
      });

      const isNewSession =
        !existing ||
        now.getTime() - existing.lastSeenAt.getTime() > SESSION_TIMEOUT_MS;

      await this.prisma.visitor.upsert({
        where: { id: visitorId },
        update: {
          lastSeenAt: now,
          ipAddress: info.ip,
          country,
          city,
          timezone,
          deviceInfo: info.deviceInfo as any,
          ...(isNewSession ? { totalVisits: { increment: 1 } } : {}),
        },
        create: {
          id: visitorId,
          ipAddress: info.ip,
          deviceInfo: info.deviceInfo as any,
          country,
          city,
          timezone,
          firstSeenAt: now,
          lastSeenAt: now,
          totalVisits: 1,
        },
      });

      // 6. Record human-readable pageview if frontend sent actual page path
      const rawPagePath = req.headers['x-page-path'];
      const pagePath =
        typeof rawPagePath === 'string' && rawPagePath.trim().startsWith('/')
          ? rawPagePath.trim().slice(0, 500)
          : null;

      if (pagePath) {
        const lastView = await this.prisma.pageView.findFirst({
          where: { visitorId },
          orderBy: { createdAt: 'desc' },
          select: { path: true, createdAt: true },
        });

        const shouldRecord =
          !lastView ||
          lastView.path !== pagePath ||
          now.getTime() - lastView.createdAt.getTime() > PAGEVIEW_DEDUP_MS;

        if (shouldRecord) {
          await this.prisma.pageView.create({
            data: {
              visitorId,
              path: pagePath,
            },
          });
        }
      }
    } catch (err: any) {
      console.error('Visitor tracking error:', err.message);
    }

    next();
  }
}
