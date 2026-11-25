import { Injectable, NotFoundException } from '@nestjs/common';
import { GuideStatus } from 'prisma/generated/prisma/enums';
import { UUID_REGEX } from 'src/common/utils/validation.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { GuideQueryDto } from './dto/guide-query.dto';
import {
  guideSummarySelect,
  publicGuideCardSelect,
  sanitizeCardTranslations,
  localizeGuideDetail,
  localizeGuideCards,
  MAX_VIEW_CACHE_ENTRIES,
  VIEW_DEDUPE_TTL_MS,
} from './constants/guide.constants';

@Injectable()
export class GuideExplorerService {
  private readonly recentViews = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  // Public Explorer List (smart species + multi-breed matching + user like/bookmark hydration)
  async findAllPublic(query: GuideQueryDto, viewerId?: string, targetLang = 'en') {
    const {
      page = 1,
      limit = 12,
      search,
      species,
      breed,
      category,
      type,
      isFeatured,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      excludeBasic,
    } = query;

    const skip = (page - 1) * limit;
    const andConditions: any[] = [
      { status: GuideStatus.PUBLISHED },
      { deletedAt: null },
    ];

    if (excludeBasic) {
      andConditions.push({
        category: {
          slug: { not: 'basic' },
          name: { not: 'Basic' },
        },
      });
    }

    if (type) {
      andConditions.push({ type });
    }

    if (isFeatured !== undefined) {
      andConditions.push({ isFeatured });
    }

    if (category && category !== 'all') {
      andConditions.push({
        category: UUID_REGEX.test(category)
          ? { id: category, isActive: true }
          : { slug: category.toLowerCase(), isActive: true },
      });
    }

    // Species & Breed Matching:
    // - If breed is selected: match guides tagged with that breed OR general species guides (no specific breeds attached)
    // - If only species is selected: match ALL guides belonging to that species
    if (breed && breed !== 'all') {
      const breedFilter = UUID_REGEX.test(breed)
        ? { id: breed }
        : { slug: breed.toLowerCase() };
      const targetBreed = await this.prisma.petBreed.findFirst({
        where: breedFilter,
        select: { id: true, speciesId: true },
      });

      if (targetBreed) {
        andConditions.push({
          OR: [
            { breeds: { some: { id: targetBreed.id } } },
            { speciesId: targetBreed.speciesId, breeds: { none: {} } },
          ],
        });
      } else {
        andConditions.push({ breeds: { some: breedFilter } });
      }
    } else if (species && species !== 'all') {
      const speciesFilter = UUID_REGEX.test(species)
        ? { id: species }
        : { slug: species.toLowerCase() };
      andConditions.push({ species: speciesFilter });
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
          { tags: { has: q.toLowerCase() } },
        ],
      });
    }

    const where = { AND: andConditions };

    const [items, total] = await Promise.all([
      this.prisma.guide.findMany({
        where,
        select: {
          ...publicGuideCardSelect,
          ...(viewerId && {
            likes: { where: { userId: viewerId }, select: { id: true } },
            bookmarks: { where: { userId: viewerId }, select: { id: true } },
          }),
        },
        skip,
        take: limit,
        orderBy:
          sortBy === 'displayOrder'
            ? [{ displayOrder: sortOrder }, { publishedAt: 'desc' as const }]
            : { [sortBy]: sortOrder },
      }),
      this.prisma.guide.count({ where }),
    ]);

    const hydratedItems = items.map((item: any) => {
      const { likes, bookmarks, ...rest } = item;
      return {
        ...rest,
        expertReviewed: Boolean(item.lastReviewedAt),
        isLiked: viewerId ? Boolean(likes?.length) : false,
        isBookmarked: viewerId ? Boolean(bookmarks?.length) : false,
      };
    });

    const localizedItems = localizeGuideCards(hydratedItems, targetLang);

    return {
      items: localizedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  // Public Basic Slider Guides: Fetches basic guides for species and breed
  async getSliderGuides(
    species?: string,
    breed?: string,
    viewerId?: string,
    targetLang = 'en',
  ) {
    const andConditions: any[] = [
      { status: GuideStatus.PUBLISHED },
      { deletedAt: null },
      {
        category: {
          OR: [
            { slug: 'basic' },
            { name: { equals: 'Basic', mode: 'insensitive' } },
          ],
        },
      },
    ];

    if (breed && breed !== 'all') {
      const breedFilter = UUID_REGEX.test(breed)
        ? { id: breed }
        : { slug: breed.toLowerCase() };
      const targetBreed = await this.prisma.petBreed.findFirst({
        where: breedFilter,
        select: { id: true, speciesId: true },
      });

      if (targetBreed) {
        andConditions.push({
          OR: [
            { breeds: { some: { id: targetBreed.id } } },
            { speciesId: targetBreed.speciesId, breeds: { none: {} } },
          ],
        });
      } else {
        andConditions.push({ breeds: { some: breedFilter } });
      }
    } else if (species && species !== 'all') {
      const speciesFilter = UUID_REGEX.test(species)
        ? { id: species }
        : { slug: species.toLowerCase() };
      andConditions.push({ species: speciesFilter });
    }

    const where = { AND: andConditions };

    const items = await this.prisma.guide.findMany({
      where,
      select: {
        ...publicGuideCardSelect,
        ...(viewerId && {
          likes: { where: { userId: viewerId }, select: { id: true } },
          bookmarks: { where: { userId: viewerId }, select: { id: true } },
        }),
      },
      take: 20,
      orderBy: [
        { displayOrder: 'asc' },
        { publishedAt: 'desc' },
      ],
    });

    const hydratedItems = items.map((item: any) => {
      const { likes, bookmarks, ...rest } = item;
      return {
        ...rest,
        expertReviewed: Boolean(item.lastReviewedAt),
        isLiked: viewerId ? Boolean(likes?.length) : false,
        isBookmarked: viewerId ? Boolean(bookmarks?.length) : false,
      };
    });

    const localizedItems = localizeGuideCards(hydratedItems, targetLang);

    return {
      items: localizedItems,
      total: localizedItems.length,
    };
  }

  // Public Detail by Slug (handles previousSlugs 301 redirect + deduplicated viewCount increment)
  async findOnePublicBySlug(
    slug: string,
    viewerId?: string,
    visitorKey = 'anon',
    targetLang = 'en',
  ) {
    let cleanSlug: string;
    try {
      cleanSlug = decodeURIComponent(slug).trim().toLowerCase();
    } catch {
      cleanSlug = slug.trim().toLowerCase();
    }

    const detailSelect = {
      ...guideSummarySelect,
      faqImage: true,
      keyTakeaways: true,
      content: true,
      metaTitle: true,
      metaDescription: true,
      translations: true,
      faqs: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' as const },
        select: { id: true, question: true, answer: true, displayOrder: true },
      },
      ...(viewerId && {
        likes: { where: { userId: viewerId }, select: { id: true } },
        bookmarks: { where: { userId: viewerId }, select: { id: true } },
      }),
    };

    let guide: any = await this.prisma.guide.findFirst({
      where: {
        slug: cleanSlug,
        status: GuideStatus.PUBLISHED,
        deletedAt: null,
      },
      select: detailSelect,
    });

    let redirectTo: string | null = null;

    // Fallback check against previousSlugs so old shared/Google links never 404
    if (!guide) {
      guide = await this.prisma.guide.findFirst({
        where: {
          previousSlugs: { has: cleanSlug },
          status: GuideStatus.PUBLISHED,
          deletedAt: null,
        },
        select: detailSelect,
      });

      if (guide) {
        redirectTo = guide.slug;
      }
    }

    if (!guide) {
      throw new NotFoundException(`Guide "${slug}" not found`);
    }

    // Only count a view on canonical URL hits (never double-count redirects or rapid refreshes)
    let didIncrementView = false;
    if (!redirectTo && this.shouldCountView(guide.id, visitorKey)) {
      await this.prisma.$executeRaw`
        UPDATE "Guide"
        SET "viewCount" = "viewCount" + 1
        WHERE "id" = ${guide.id}
      `;
      didIncrementView = true;
    }

    // Priority-based related guides (Category -> Breed -> Species -> Fallback)
    const relatedGuides = await this.findRelatedGuides(guide.id, 4, targetLang);

    const { likes, bookmarks, ...guideData } = guide;

    const baseGuide = {
      ...guideData,
      viewCount: guideData.viewCount + (didIncrementView ? 1 : 0),
      isLiked: viewerId ? Boolean(likes?.length) : false,
      isBookmarked: viewerId ? Boolean(bookmarks?.length) : false,
    };

    const localizedGuide = localizeGuideDetail(baseGuide, targetLang);

    return {
      redirectTo,
      guide: localizedGuide,
      relatedGuides,
    };
  }

  // Find related guides: Priority 1: Similar category -> Priority 2: Breed -> Priority 3: Species -> Fallback
  async findRelatedGuides(idOrSlug: string, limit = 4, targetLang = 'en') {
    let cleanKey: string;
    try {
      cleanKey = decodeURIComponent(idOrSlug).trim().toLowerCase();
    } catch {
      cleanKey = idOrSlug.trim().toLowerCase();
    }

    const isUuid = UUID_REGEX.test(cleanKey);

    const target = await this.prisma.guide.findFirst({
      where: {
        OR: [
          ...(isUuid
            ? [{ id: cleanKey }]
            : [{ slug: cleanKey }, { previousSlugs: { has: cleanKey } }]),
        ],
        status: GuideStatus.PUBLISHED,
        deletedAt: null,
      },
      select: {
        id: true,
        categoryId: true,
        speciesId: true,
        breeds: { select: { id: true } },
      },
    });

    if (!target) {
      return [];
    }

    const baseWhere = {
      status: GuideStatus.PUBLISHED,
      deletedAt: null,
      id: { not: target.id },
    };

    const breedIds = target.breeds?.map((b) => b.id) || [];
    const relatedSelect = {
      ...guideSummarySelect,
      translations: true,
    };

    // Priority 1: Similar category
    let related = await this.prisma.guide.findMany({
      where: {
        ...baseWhere,
        categoryId: target.categoryId,
      },
      select: relatedSelect,
      orderBy: [
        { displayOrder: 'asc' },
        { viewCount: 'desc' },
        { publishedAt: 'desc' },
      ],
      take: limit,
    });

    // Priority 2: If no related guides in that similar category, check breed
    if (related.length === 0 && breedIds.length > 0) {
      related = await this.prisma.guide.findMany({
        where: {
          ...baseWhere,
          breeds: { some: { id: { in: breedIds } } },
        },
        select: relatedSelect,
        orderBy: [
          { displayOrder: 'asc' },
          { viewCount: 'desc' },
          { publishedAt: 'desc' },
        ],
        take: limit,
      });
    }

    // Priority 3: If no breed guides (or no breeds attached), check species
    if (related.length === 0 && target.speciesId) {
      related = await this.prisma.guide.findMany({
        where: {
          ...baseWhere,
          speciesId: target.speciesId,
        },
        select: relatedSelect,
        orderBy: [
          { displayOrder: 'asc' },
          { viewCount: 'desc' },
          { publishedAt: 'desc' },
        ],
        take: limit,
      });
    }

    // Priority 4: Fallback to general published guides if still empty
    if (related.length === 0) {
      related = await this.prisma.guide.findMany({
        where: baseWhere,
        select: relatedSelect,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: limit,
      });
    }

    return localizeGuideCards(related, targetLang);
  }

  // Find guides by species
  async findGuidesBySpecies(speciesIdOrSlug: string, query?: GuideQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
    } = query || {};

    const skip = (page - 1) * limit;

    const species = await this.prisma.petSpecies.findFirst({
      where: UUID_REGEX.test(speciesIdOrSlug)
        ? { id: speciesIdOrSlug }
        : { slug: speciesIdOrSlug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryIcon: true,
      },
    });

    if (!species) {
      throw new NotFoundException(`Species '${speciesIdOrSlug}' not found`);
    }

    const andConditions: any[] = [
      { speciesId: species.id },
      { deletedAt: null },
    ];

    if (status) {
      andConditions.push({ status });
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
          { tags: { has: q.toLowerCase() } },
        ],
      });
    }

    const where = { AND: andConditions };
    const sortField = sortBy || 'publishedAt';
    const orderBy =
      sortField === 'publishedAt'
        ? [{ publishedAt: sortOrder }, { createdAt: 'desc' }]
        : { [sortField]: sortOrder };

    const [items, total] = await Promise.all([
      this.prisma.guide.findMany({
        where,
        select: {
          ...guideSummarySelect,
          reviewNotes: true,
        },
        skip,
        take: limit,
        orderBy: orderBy as any,
      }),
      this.prisma.guide.count({ where }),
    ]);

    return {
      species,
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  // Find guides by breed
  async findGuidesByBreed(breedIdOrSlug: string, query?: GuideQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
    } = query || {};

    const skip = (page - 1) * limit;

    const breed = await this.prisma.petBreed.findFirst({
      where: UUID_REGEX.test(breedIdOrSlug)
        ? { id: breedIdOrSlug }
        : { slug: breedIdOrSlug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        speciesId: true,
        species: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!breed) {
      throw new NotFoundException(`Breed '${breedIdOrSlug}' not found`);
    }

    const andConditions: any[] = [
      { breeds: { some: { id: breed.id } } },
      { deletedAt: null },
    ];

    if (status) {
      andConditions.push({ status });
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
          { tags: { has: q.toLowerCase() } },
        ],
      });
    }

    const where = { AND: andConditions };
    const sortField = sortBy || 'publishedAt';
    const orderBy =
      sortField === 'publishedAt'
        ? [{ publishedAt: sortOrder }, { createdAt: 'desc' }]
        : { [sortField]: sortOrder };

    const [items, total] = await Promise.all([
      this.prisma.guide.findMany({
        where,
        select: {
          ...guideSummarySelect,
          reviewNotes: true,
        },
        skip,
        take: limit,
        orderBy: orderBy as any,
      }),
      this.prisma.guide.count({ where }),
    ]);

    return {
      breed,
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  private shouldCountView(guideId: string, visitorKey: string): boolean {
    const now = Date.now();
    const cacheKey = `${guideId}:${visitorKey}`;
    const lastViewedAt = this.recentViews.get(cacheKey);

    if (lastViewedAt && now - lastViewedAt < VIEW_DEDUPE_TTL_MS) {
      return false;
    }

    if (this.recentViews.size >= MAX_VIEW_CACHE_ENTRIES) {
      for (const [key, timestamp] of this.recentViews) {
        if (now - timestamp >= VIEW_DEDUPE_TTL_MS) {
          this.recentViews.delete(key);
        }
      }
      if (this.recentViews.size >= MAX_VIEW_CACHE_ENTRIES) {
        const oldestKey = this.recentViews.keys().next().value;
        if (oldestKey) {
          this.recentViews.delete(oldestKey);
        }
      }
    }

    this.recentViews.set(cacheKey, now);
    return true;
  }
}
