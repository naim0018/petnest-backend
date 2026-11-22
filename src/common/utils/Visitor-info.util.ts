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

function getSingleHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && value.length > 0) return value[0].trim();
  return undefined;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractVisitorInfo(req: Request): VisitorInfo {
  // 1. Extract Real IP Address (Handles proxies, reverse proxies, and localhost)
  const forwardedFor = req.headers['x-forwarded-for'];
  let ip = '127.0.0.1';

  if (typeof forwardedFor === 'string') {
    ip = forwardedFor.split(',')[0].trim();
  } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    ip = forwardedFor[0].split(',')[0].trim();
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Normalize IPv6 localhost `::1` or `::ffff:127.0.0.1` to readable IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  ip = ip.slice(0, 64);

  // 2. Extract Location (Vercel -> Cloudflare -> AWS CloudFront -> Localhost fallback)
  const isDev = process.env.NODE_ENV !== 'production';

  const rawCountry =
    getSingleHeader(req.headers['x-vercel-ip-country']) ||
    getSingleHeader(req.headers['cf-ipcountry']) ||
    getSingleHeader(req.headers['cloudfront-viewer-country']);

  const rawCity =
    getSingleHeader(req.headers['x-vercel-ip-city']) ||
    getSingleHeader(req.headers['cf-ipcity']) ||
    getSingleHeader(req.headers['cloudfront-viewer-city']);

  const rawTimezone =
    getSingleHeader(req.headers['x-timezone']) ||
    getSingleHeader(req.headers['x-vercel-ip-timezone']) ||
    getSingleHeader(req.headers['cf-timezone']) ||
    getSingleHeader(req.headers['cloudfront-viewer-time-zone']);

  const TIMEZONE_TO_LOCATION: Record<string, { country: string; city: string }> = {
    'Asia/Dhaka': { country: 'Bangladesh', city: 'Dhaka' },
    'Asia/Kolkata': { country: 'India', city: 'New Delhi' },
    'America/New_York': { country: 'United States', city: 'New York' },
    'America/Los_Angeles': { country: 'United States', city: 'Los Angeles' },
    'America/Chicago': { country: 'United States', city: 'Chicago' },
    'America/Toronto': { country: 'Canada', city: 'Toronto' },
    'Europe/London': { country: 'United Kingdom', city: 'London' },
    'Europe/Berlin': { country: 'Germany', city: 'Berlin' },
    'Europe/Paris': { country: 'France', city: 'Paris' },
    'Asia/Tokyo': { country: 'Japan', city: 'Tokyo' },
    'Australia/Sydney': { country: 'Australia', city: 'Sydney' },
  };

  const tzLoc = rawTimezone ? TIMEZONE_TO_LOCATION[rawTimezone] : null;

  // Fallbacks guarantee bounded non-null strings matching Prisma schema
  const country = (
    rawCountry ||
    tzLoc?.country ||
    (isDev ? 'Bangladesh' : 'Unknown')
  ).slice(0, 100);

  const city = (
    rawCity
      ? safeDecodeURIComponent(rawCity)
      : tzLoc?.city || (isDev ? 'Dhaka' : 'Unknown')
  ).slice(0, 100);

  const timezone = (rawTimezone || (isDev ? 'Asia/Dhaka' : 'UTC')).slice(0, 100);

  // 3. Extract Device, OS, and Browser Info from User-Agent
  const userAgent = (getSingleHeader(req.headers['user-agent']) || '').slice(
    0,
    512,
  );
  const parser = new UAParser(userAgent);
  const parsed = parser.getResult();

  const deviceInfo = {
    browser:
      `${parsed.browser.name || 'Unknown'} ${parsed.browser.major || ''}`.trim(),
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
