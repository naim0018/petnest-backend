import type { Request } from 'express';
import { GuideStatus } from 'prisma/generated/prisma/enums';
import { extractVisitorInfo } from 'src/common/utils/Visitor-info.util';

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

export const publicGuideCardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  type: true,
  coverImage: true,
  coverImageAlt: true,
  readTimeMinutes: true,
  displayOrder: true,
  publishedAt: true,
  lastReviewedAt: true,
  likeCount: true,
  bookmarkCount: true,
  translations: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
    },
  },
  species: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  breeds: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
};

export function sanitizeCardTranslations(
  translations: any,
): Record<string, { title?: string; excerpt?: string }> | null {
  if (!translations || typeof translations !== 'object') return null;
  const sanitized: Record<string, { title?: string; excerpt?: string }> = {};
  for (const [locale, val] of Object.entries(translations)) {
    if (val && typeof val === 'object') {
      const { title, excerpt } = val as any;
      if (title || excerpt) {
        sanitized[locale] = {
          ...(title && { title: String(title) }),
          ...(excerpt && { excerpt: String(excerpt) }),
        };
      }
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Resolves visitor's preferred language using a 5-tier priority ladder:
 * 1. Query parameter (?lang=bn or ?lang=en)
 * 2. Cookie 'petnest_lang' (explicit user selection)
 * 3. Cookie 'googtrans' (Google Translate target language, e.g. /en/bn)
 * 4. Header 'x-visitor-lang'
 * 5. IP Geo-detection / Timezone (Bangladesh / BD IP / Asia/Dhaka -> 'bn')
 * Default: 'en'
 */
export function resolveTargetLocale(req: Request): {
  targetLang: string;
  isAutoDetected: boolean;
} {
  // 1. Explicit query parameter (?lang=bn or ?lang=en; ?lang=auto forces location detection)
  const queryLang =
    typeof req.query?.lang === 'string'
      ? req.query.lang.toLowerCase().trim()
      : null;
  if (queryLang === 'bn' || queryLang === 'en') {
    return { targetLang: queryLang, isAutoDetected: false };
  }

  // 2. Cookie 'petnest_lang' (explicit user selection)
  const cookieLang = req.cookies?.['petnest_lang'];
  if (typeof cookieLang === 'string' && queryLang !== 'auto') {
    const clean = cookieLang.toLowerCase().trim();
    if (clean === 'bn' || clean === 'en') {
      return { targetLang: clean, isAutoDetected: false };
    }
  }

  // 3. Cookie 'googtrans' (e.g. "/en/bn" or "/auto/bn")
  const googTrans = req.cookies?.['googtrans'];
  if (typeof googTrans === 'string' && queryLang !== 'auto') {
    const parts = googTrans.split('/');
    const code = parts[parts.length - 1]?.toLowerCase()?.trim();
    if (code === 'bn') {
      return { targetLang: 'bn', isAutoDetected: false };
    }
  }

  // 4. Custom header 'x-visitor-lang'
  const headerLang = req.headers['x-visitor-lang'];
  if (typeof headerLang === 'string' && queryLang !== 'auto') {
    const clean = headerLang.toLowerCase().trim();
    if (clean === 'bn' || clean === 'en') {
      return { targetLang: clean, isAutoDetected: false };
    }
  }

  // 5. Geolocation / IP Country / Timezone detection
  const visitorInfo = extractVisitorInfo(req);
  const rawCountry =
    (typeof req.headers['cf-ipcountry'] === 'string'
      ? req.headers['cf-ipcountry']
      : null) ||
    (typeof req.headers['x-vercel-ip-country'] === 'string'
      ? req.headers['x-vercel-ip-country']
      : null) ||
    (typeof req.headers['cloudfront-viewer-country'] === 'string'
      ? req.headers['cloudfront-viewer-country']
      : null);

  const rawTimezone =
    (typeof req.headers['x-timezone'] === 'string'
      ? req.headers['x-timezone']
      : null) ||
    (typeof req.headers['x-vercel-ip-timezone'] === 'string'
      ? req.headers['x-vercel-ip-timezone']
      : null) ||
    (typeof req.headers['cf-timezone'] === 'string'
      ? req.headers['cf-timezone']
      : null);

  const isBd =
    rawCountry?.toUpperCase() === 'BD' ||
    rawTimezone === 'Asia/Dhaka' ||
    visitorInfo.country === 'Bangladesh' ||
    visitorInfo.timezone === 'Asia/Dhaka';

  if (isBd) {
    return { targetLang: 'bn', isAutoDetected: true };
  }

  return { targetLang: 'en', isAutoDetected: false };
}

/**
 * Localizes a single guide detail payload.
 * When serving Bangla, swaps top-level fields and strips redundant English translations body,
 * cutting response payload size by ~50%.
 */
export function localizeGuideDetail(guide: any, targetLang: string) {
  if (!guide) return guide;

  const rawTranslations = guide.translations;
  const bnVariant = rawTranslations?.bn;
  const hasBn = Boolean(
    bnVariant &&
      ((typeof bnVariant.title === 'string' && bnVariant.title.trim()) ||
        (typeof bnVariant.content === 'string' && bnVariant.content.trim())),
  );

  const availableLocales = ['en'];
  if (hasBn) {
    availableLocales.push('bn');
  }

  // Swap to Bangla if requested AND available
  if (targetLang === 'bn' && hasBn) {
    const localizedTitle = bnVariant.title?.trim() || guide.title;
    const localizedExcerpt = bnVariant.excerpt?.trim() || guide.excerpt;
    const localizedContent = bnVariant.content?.trim() || guide.content;
    const localizedKeyTakeaways =
      Array.isArray(bnVariant.keyTakeaways) && bnVariant.keyTakeaways.length > 0
        ? bnVariant.keyTakeaways
        : guide.keyTakeaways;

    let localizedFaqs = guide.faqs;
    if (Array.isArray(bnVariant.faqs) && bnVariant.faqs.length > 0) {
      localizedFaqs = bnVariant.faqs.map((f: any, idx: number) => ({
        id: f.id || `bn-faq-${idx}`,
        question: f.question || '',
        answer: f.answer || '',
        displayOrder: f.displayOrder ?? idx,
      }));
    }

    const { translations: _strip, ...cleanGuide } = guide;

    return {
      ...cleanGuide,
      title: localizedTitle,
      excerpt: localizedExcerpt,
      content: localizedContent,
      keyTakeaways: localizedKeyTakeaways,
      faqs: localizedFaqs,
      locale: 'bn',
      isNativeTranslation: true,
      availableLocales,
    };
  }

  // Default: Serve English and strip duplicate payload body
  const { translations: _strip, ...cleanGuide } = guide;
  return {
    ...cleanGuide,
    locale: 'en',
    isNativeTranslation: false,
    availableLocales,
  };
}

/**
 * Localizes guide card items for listing and related guides.
 */
export function localizeGuideCards(items: any[], targetLang: string) {
  if (!Array.isArray(items)) return items;

  if (targetLang !== 'bn') {
    return items.map((item) => {
      const { translations, ...rest } = item;
      const hasBn = Boolean(translations?.bn);
      return {
        ...rest,
        locale: 'en',
        isNativeTranslation: false,
        availableLocales: hasBn ? ['en', 'bn'] : ['en'],
      };
    });
  }

  return items.map((item) => {
    const rawTranslations = item.translations;
    const bnVariant = rawTranslations?.bn;
    const hasBn = Boolean(
      bnVariant &&
        ((typeof bnVariant.title === 'string' && bnVariant.title.trim()) ||
          (typeof bnVariant.excerpt === 'string' && bnVariant.excerpt.trim())),
    );
    const { translations, ...rest } = item;

    if (hasBn) {
      return {
        ...rest,
        title: bnVariant.title?.trim() || item.title,
        excerpt: bnVariant.excerpt?.trim() || item.excerpt,
        locale: 'bn',
        isNativeTranslation: true,
        availableLocales: ['en', 'bn'],
      };
    }

    return {
      ...rest,
      locale: 'en',
      isNativeTranslation: false,
      availableLocales: ['en'],
    };
  });
}

export const guideSummarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  type: true,
  coverImage: true,
  readTimeMinutes: true,
  displayOrder: true,
  tags: true,
  status: true,
  isFeatured: true,
  viewCount: true,
  likeCount: true,
  bookmarkCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
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
};
