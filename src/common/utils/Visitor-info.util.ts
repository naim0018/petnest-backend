// src/common/utils/Visitor-info.util.ts
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

export interface VisitorInfo {
  ip: string;
  country: string;
  city: string;
  timezone: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
    model: string | null;
  };
}

export function extractVisitorInfo(req: Request): VisitorInfo {
  // 1. Extract Real IP Address (Handles proxies, reverse proxies, and localhost)
  const forwardedFor = req.headers['x-forwarded-for'];
  let ip = '127.0.0.1';

  if (typeof forwardedFor === 'string') {
    ip = forwardedFor.split(',')[0].trim();
  } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    ip = forwardedFor[0].trim();
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Normalize IPv6 localhost `::1` or `::ffff:127.0.0.1` to readable IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }

  // 2. Extract Location (Vercel -> Cloudflare -> AWS CloudFront -> Localhost fallback)
  const isDev = process.env.NODE_ENV !== 'production';

  const rawCountry = (
    req.headers['x-vercel-ip-country'] ||
    req.headers['cf-ipcountry'] ||
    req.headers['cloudfront-viewer-country']
  ) as string | undefined;

  const rawCity = (
    req.headers['x-vercel-ip-city'] ||
    req.headers['cf-ipcity'] ||
    req.headers['cloudfront-viewer-city']
  ) as string | undefined;

  const rawTimezone = (
    req.headers['x-vercel-ip-timezone'] ||
    req.headers['cf-timezone'] ||
    req.headers['cloudfront-viewer-time-zone']
  ) as string | undefined;

  // Fallbacks guarantee non-null strings matching your Prisma schema
  const country = rawCountry || (isDev ? 'Localhost' : 'Unknown');
  const city = rawCity
    ? decodeURIComponent(rawCity)
    : isDev
      ? 'Localhost'
      : 'Unknown';
  const timezone = rawTimezone || (isDev ? 'UTC' : 'Unknown');

  // 3. Extract Device, OS, and Browser Info from User-Agent
  const userAgent = (req.headers['user-agent'] as string) || '';
  const parser = new UAParser(userAgent);
  const parsed = parser.getResult();

  const deviceInfo = {
    browser: `${parsed.browser.name || 'Unknown'} ${parsed.browser.major || ''}`.trim(),
    os: `${parsed.os.name || 'Unknown'} ${parsed.os.version || ''}`.trim(),
    device: parsed.device.type || 'Desktop',
    model: parsed.device.model || null,
  };

  return {
    ip,
    country,
    city,
    timezone,
    deviceInfo,
  };
}