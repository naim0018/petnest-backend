import { BadRequestException } from '@nestjs/common';

export function slugifyListing(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base) {
    throw new BadRequestException('Listing title must contain alphanumeric characters');
  }

  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${randomSuffix}`;
}

export function isStaffRole(role?: string): boolean {
  if (!role) return false;
  const normalized = role.toUpperCase();
  return normalized === 'ADMIN' || normalized === 'SUPERADMIN';
}

export function normalizeMediaPayload<T extends Record<string, any>>(
  dto: T,
  includeLegacyVideoUrl = false,
): Omit<T, 'coverImage' | 'thumbnailImage' | 'videoUrls' | 'videoUrl'> & {
  coverImage: string;
  thumbnailImage: string;
  videoUrls: string[];
  videoUrl?: string | null;
} {
  const thumbnailImage = dto.thumbnailImage || dto.coverImage || '';
  const coverImage = dto.coverImage || dto.thumbnailImage || '';
  const videoUrls = dto.videoUrls || (dto.videoUrl ? [dto.videoUrl] : []);

  const res: any = {
    ...dto,
    thumbnailImage,
    coverImage,
    videoUrls,
  };

  if (includeLegacyVideoUrl) {
    res.videoUrl = dto.videoUrl || videoUrls[0] || null;
  } else {
    delete res.videoUrl;
  }

  return res;
}

export function sanitizeListingForViewer<T extends Record<string, any>>(
  item: T,
  isStaff = false,
): T {
  if (!item) return item;
  const sanitized: any = { ...item };
  if (!sanitized.thumbnailImage && sanitized.coverImage) {
    sanitized.thumbnailImage = sanitized.coverImage;
  }
  if (!sanitized.coverImage && sanitized.thumbnailImage) {
    sanitized.coverImage = sanitized.thumbnailImage;
  }
  if (!sanitized.videoUrls && sanitized.videoUrl) {
    sanitized.videoUrls = [sanitized.videoUrl];
  }
  if (!isStaff) {
    delete sanitized.buyingPrice;
  }
  return sanitized as T;
}
