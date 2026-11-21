import { Injectable, NotFoundException } from '@nestjs/common';
import { GuideStatus } from 'prisma/generated/prisma/enums';
import { UUID_REGEX } from 'src/common/utils/validation.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { GuideQueryDto } from './dto/guide-query.dto';
import {
  guideSummarySelect,
  MAX_VIEW_CACHE_ENTRIES,
  VIEW_DEDUPE_TTL_MS,
} from './constants/guide.constants';

@Injectable()
export class GuideExplorerService {
  private readonly recentViews = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  // Public Explorer List (smart species + multi-breed matching + user like/bookmark hydration)
  async findAllPublic(query: GuideQueryDto, viewerId?: string) {
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
    } = query;

    const skip = (page - 1) * limit;
    const andConditions: any[] = [
      { status: GuideStatus.PUBLISHED },
      { deletedAt: null },
    ];

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
          ...guideSummarySelect,
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
        isLiked: viewerId ? Boolean(likes?.length) : false,
        isBookmarked: viewerId ? Boolean(bookmarks?.length) : false,
      };
    });

    return {
      items: hydratedItems,
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

  // Public Detail by Slug (handles previousSlugs 301 redirect + deduplicated viewCount increment)
  async findOnePublicBySlug(
    slug: string,
    viewerId?: string,
    visitorKey = 'anon',
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

    const relatedGuides = await this.prisma.guide.findMany({
      where: {
        status: GuideStatus.PUBLISHED,
        deletedAt: null,
        id: { not: guide.id },
        OR: [
          ...(guide.species?.id ? [{ speciesId: guide.species.id }] : []),
          { categoryId: guide.category.id },
        ],
      },
      select: guideSummarySelect,
      orderBy: { viewCount: 'desc' },
      take: 3,
    });

    const { likes, bookmarks, ...guideData } = guide;

    return {
      redirectTo,
      guide: {
        ...guideData,
        viewCount: guideData.viewCount + (didIncrementView ? 1 : 0),
        isLiked: viewerId ? Boolean(likes?.length) : false,
        isBookmarked: viewerId ? Boolean(bookmarks?.length) : false,
      },
      relatedGuides,
    };
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
