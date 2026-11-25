import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface VisitorRecordDto {
  id: string;
  ipAddress: string;
  maskedIp: string;
  country: string;
  city: string;
  timezone: string;
  browser: string;
  os: string;
  deviceType: string;
  totalVisits: number;
  firstSeenAt: string;
  lastSeenAt: string;
  recentPath?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface GeoDistributionDto {
  country: string;
  city?: string;
  code: string;
  visitors: number;
  totalVisits: number;
  share: string;
  lat: number;
  lng: number;
}

export interface VisitorAnalyticsResponse {
  stats: {
    totalVisitors: number;
    activeVisitors24h: number;
    totalPageViews: number;
    avgVisitsPerUser: number;
    registeredLinkedCount: number;
  };
  geoDistribution: GeoDistributionDto[];
  recentVisitors: VisitorRecordDto[];
  topVisitedPaths: { path: string; count: number }[];
  visitorTrend: { label: string; visitors: number; pageViews: number }[];
}

const CITY_COORDINATES: Record<string, { code: string; lat: number; lng: number }> = {
  // Bangladesh
  'Dhaka': { code: 'BD', lat: 23.8103, lng: 90.4125 },
  'Chittagong': { code: 'BD', lat: 22.3569, lng: 91.7832 },
  'Chattogram': { code: 'BD', lat: 22.3569, lng: 91.7832 },
  'Sylhet': { code: 'BD', lat: 24.8949, lng: 91.8687 },
  'Rajshahi': { code: 'BD', lat: 24.3636, lng: 88.6241 },
  'Khulna': { code: 'BD', lat: 22.8456, lng: 89.5403 },
  'Barisal': { code: 'BD', lat: 22.701, lng: 90.3535 },
  'Rangpur': { code: 'BD', lat: 25.7439, lng: 89.2752 },
  'Mymensingh': { code: 'BD', lat: 24.7471, lng: 90.4203 },
  'Comilla': { code: 'BD', lat: 23.4682, lng: 91.1788 },
  // India
  'Kolkata': { code: 'IN', lat: 22.5726, lng: 88.3639 },
  'New Delhi': { code: 'IN', lat: 28.6139, lng: 77.209 },
  'Delhi': { code: 'IN', lat: 28.6139, lng: 77.209 },
  'Mumbai': { code: 'IN', lat: 19.076, lng: 72.8777 },
  'Bengaluru': { code: 'IN', lat: 12.9716, lng: 77.5946 },
  'Bangalore': { code: 'IN', lat: 12.9716, lng: 77.5946 },
  // North America
  'New York': { code: 'US', lat: 40.7128, lng: -74.006 },
  'Los Angeles': { code: 'US', lat: 34.0522, lng: -118.2437 },
  'Chicago': { code: 'US', lat: 41.8781, lng: -87.6298 },
  'San Francisco': { code: 'US', lat: 37.7749, lng: -122.4194 },
  'Toronto': { code: 'CA', lat: 43.6532, lng: -79.3832 },
  'Vancouver': { code: 'CA', lat: 49.2827, lng: -123.1207 },
  // Europe
  'London': { code: 'GB', lat: 51.5074, lng: -0.1278 },
  'Berlin': { code: 'DE', lat: 52.52, lng: 13.405 },
  'Paris': { code: 'FR', lat: 48.8566, lng: 2.3522 },
  'Amsterdam': { code: 'NL', lat: 52.3676, lng: 4.9041 },
  'Stockholm': { code: 'SE', lat: 59.3293, lng: 18.0686 },
  // Asia & Oceania
  'Tokyo': { code: 'JP', lat: 35.6762, lng: 139.6503 },
  'Sydney': { code: 'AU', lat: -33.8688, lng: 151.2093 },
  'Melbourne': { code: 'AU', lat: -37.8136, lng: 144.9631 },
  'Singapore': { code: 'SG', lat: 1.3521, lng: 103.8198 },
  'Dubai': { code: 'AE', lat: 25.2048, lng: 55.2708 },
};

const COUNTRY_COORDINATES: Record<string, { code: string; lat: number; lng: number }> = {
  'Bangladesh': { code: 'BD', lat: 23.8103, lng: 90.4125 },
  'United States': { code: 'US', lat: 37.0902, lng: -95.7129 },
  'United Kingdom': { code: 'GB', lat: 55.3781, lng: -3.436 },
  'Germany': { code: 'DE', lat: 51.1657, lng: 10.4515 },
  'France': { code: 'FR', lat: 46.2276, lng: 2.2137 },
  'Australia': { code: 'AU', lat: -25.2744, lng: 133.7751 },
  'India': { code: 'IN', lat: 20.5937, lng: 78.9629 },
  'Canada': { code: 'CA', lat: 56.1304, lng: -106.3468 },
  'Japan': { code: 'JP', lat: 36.2048, lng: 138.2529 },
  'Brazil': { code: 'BR', lat: -14.235, lng: -51.9253 },
  'Netherlands': { code: 'NL', lat: 52.1326, lng: 5.2913 },
  'Sweden': { code: 'SE', lat: 60.1282, lng: 18.6435 },
  'United Arab Emirates': { code: 'AE', lat: 23.4241, lng: 53.8478 },
  'Singapore': { code: 'SG', lat: 1.3521, lng: 103.8198 },
};

function resolveLocationCoords(city?: string | null, country?: string | null) {
  if (city && CITY_COORDINATES[city]) {
    return CITY_COORDINATES[city];
  }
  if (country && COUNTRY_COORDINATES[country]) {
    return COUNTRY_COORDINATES[country];
  }
  return null;
}

function maskIp(ip?: string | null): string {
  if (!ip || ip === 'Unknown' || ip === '::1' || ip === '127.0.0.1') {
    return '127.0.***.***';
  }
  const cleanIp = ip.replace(/^::ffff:/, '');
  const parts = cleanIp.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  const v6 = cleanIp.split(':');
  if (v6.length > 2) {
    return `${v6.slice(0, 2).join(':')}:****:****`;
  }
  return '***.***.***.***';
}

function parseDeviceInfo(deviceInfo: any): { browser: string; os: string; deviceType: string } {
  if (!deviceInfo || typeof deviceInfo !== 'object') {
    return { browser: 'Chrome', os: 'Windows', deviceType: 'Desktop' };
  }
  const browser =
    deviceInfo.browser && deviceInfo.browser !== 'Unknown'
      ? deviceInfo.browser
      : 'Chrome';
  const os =
    deviceInfo.os && deviceInfo.os !== 'Unknown'
      ? deviceInfo.os
      : 'Windows';
  const deviceType = deviceInfo.device || deviceInfo.deviceType || 'Desktop';
  return { browser, os, deviceType };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getVisitorAnalytics(): Promise<VisitorAnalyticsResponse> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalVisitors,
      activeVisitors24h,
      totalPageViews,
      aggregateVisits,
      registeredCount,
      rawGeo,
      rawVisitors,
      rawTopPaths,
    ] = await Promise.all([
      this.prisma.visitor.count(),
      this.prisma.visitor.count({ where: { lastSeenAt: { gte: last24h } } }),
      this.prisma.pageView.count(),
      this.prisma.visitor.aggregate({ _sum: { totalVisits: true } }),
      this.prisma.visitor.count({ where: { userId: { not: null } } }),
      this.prisma.visitor.groupBy({
        by: ['country', 'city'],
        _count: { id: true },
        _sum: { totalVisits: true },
        orderBy: { _count: { id: 'desc' } },
        take: 30,
      }),
      this.prisma.visitor.findMany({
        take: 50,
        orderBy: { lastSeenAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          pageViews: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { path: true },
          },
        },
      }),
      this.prisma.pageView.groupBy({
        by: ['path'],
        where: {
          path: { notIn: ['/', '/graphql'] },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const totalSum =
      aggregateVisits._sum.totalVisits || (totalVisitors > 0 ? totalVisitors : 0);
    const avgVisits =
      totalVisitors > 0 ? Number((totalSum / totalVisitors).toFixed(1)) : 1.0;

    // Process geographic breakdown
    const geoMap = new Map<string, GeoDistributionDto>();
    for (const g of rawGeo) {
      if (!g.country || g.country === 'Unknown') continue;
      const cName = g.country;
      const city = g.city && g.city !== 'Unknown' ? g.city : undefined;
      const key = city ? `${cName}:${city}` : cName;
      const visits = Number(g._sum.totalVisits || g._count.id);
      const visitors = Number(g._count.id);
      const coords = resolveLocationCoords(city, cName) || {
        code: cName.slice(0, 2).toUpperCase(),
        lat: 23.8103,
        lng: 90.4125,
      };

      const existing = geoMap.get(key);
      if (existing) {
        existing.visitors += visitors;
        existing.totalVisits += visits;
      } else {
        geoMap.set(key, {
          country: cName,
          city,
          code: coords.code,
          visitors,
          totalVisits: visits,
          share: '0%',
          lat: coords.lat,
          lng: coords.lng,
        });
      }
    }

    const geoDistribution: GeoDistributionDto[] = Array.from(geoMap.values()).map(
      (item) => ({
        ...item,
        share:
          totalSum > 0
            ? `${Math.max(1, Math.round((item.totalVisits / totalSum) * 100))}%`
            : '100%',
      }),
    );

    // Recent visitors list
    const recentVisitors: VisitorRecordDto[] = rawVisitors.map((v) => {
      const dev = parseDeviceInfo(v.deviceInfo);
      return {
        id: v.id,
        ipAddress: v.ipAddress || '127.0.0.1',
        maskedIp: maskIp(v.ipAddress),
        country: v.country || 'Unknown',
        city: v.city || 'Unknown',
        timezone: v.timezone || 'UTC',
        browser: dev.browser,
        os: dev.os,
        deviceType: dev.deviceType,
        totalVisits: v.totalVisits,
        firstSeenAt: v.firstSeenAt.toISOString(),
        lastSeenAt: v.lastSeenAt.toISOString(),
        recentPath: v.pageViews[0]?.path || '/',
        user: v.user,
      };
    });

    // Top visited paths
    const topVisitedPaths = rawTopPaths.map((tp) => ({
      path: tp.path,
      count: tp._count.id,
    }));

    // Monthly trend
    const visitorTrend = [
      { label: 'Nov', visitors: totalVisitors, pageViews: totalPageViews },
    ];

    return {
      stats: {
        totalVisitors,
        activeVisitors24h,
        totalPageViews,
        avgVisitsPerUser: avgVisits,
        registeredLinkedCount: registeredCount,
      },
      geoDistribution,
      recentVisitors,
      topVisitedPaths,
      visitorTrend,
    };
  }
}
