import { GuideStatus } from 'prisma/generated/prisma/enums';

export const RESERVED_GUIDE_SLUGS = new Set([
  'all',
  'stats',
  'categories',
  'faqs',
  'editorial',
  'admin',
  'me',
  'new',
  'create',
  'edit',
]);

export const EDITORIAL_REVIEWER_ROLES = new Set(['VET', 'ADMIN', 'SUPERADMIN']);
export const AUTHOR_ALLOWED_STATUSES = new Set<GuideStatus>([
  GuideStatus.DRAFT,
  GuideStatus.IN_REVIEW,
]);

export const VIEW_DEDUPE_TTL_MS = 10 * 60 * 1000; // 10 minutes per reader per guide
export const MAX_VIEW_CACHE_ENTRIES = 5000;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const guideSummarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  type: true,
  translations: true,
  coverImage: true,
  coverImageAlt: true,
  videoUrl: true,
  readTimeMinutes: true,
  displayOrder: true,
  tags: true,
  status: true,
  isFeatured: true,
  lastReviewedAt: true,
  viewCount: true,
  likeCount: true,
  bookmarkCount: true,
  publishedAt: true,
  contentUpdatedAt: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
  species: { select: { id: true, name: true, slug: true, categoryIcon: true } },
  breeds: { select: { id: true, name: true, slug: true, image: true } },
  author: {
    select: {
      id: true,
      name: true,
      role: true,
      profile: { select: { avatar: true, specialization: true } },
    },
  },
  reviewer: {
    select: {
      id: true,
      name: true,
      role: true,
      profile: { select: { avatar: true, specialization: true } },
    },
  },
};
