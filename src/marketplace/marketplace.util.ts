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
