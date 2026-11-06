import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuideStatus } from 'prisma/generated/prisma/enums';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { UUID_REGEX } from 'src/common/utils/validation.util';
import { MediaService } from 'src/media/media.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGuideDto } from './dto/create-guide.dto';
import { GuideQueryDto } from './dto/guide-query.dto';
import { ReviewDecision, ReviewGuideDto } from './dto/review-guide.dto';
import { UpdateGuideDto } from './dto/update-guide.dto';
import {
  calculateReadTimeMinutes,
  sanitizeGuideHtml,
  validateExternalVideoUrl,
} from './utils/guide-content.util';

const RESERVED_GUIDE_SLUGS = new Set([
  'categories',
  'faqs',
  'editorial',
  'admin',
  'me',
  'new',
  'create',
  'edit',
]);

const EDITORIAL_REVIEWER_ROLES = new Set(['VET', 'ADMIN', 'SUPERADMIN']);
const AUTHOR_ALLOWED_STATUSES = new Set<GuideStatus>([
  GuideStatus.DRAFT,
  GuideStatus.IN_REVIEW,
]);

const VIEW_DEDUPE_TTL_MS = 10 * 60 * 1000; // 10 minutes per reader per guide
const MAX_VIEW_CACHE_ENTRIES = 5000;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const guideSummarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  type: true,
  coverImage: true,
  coverImageAlt: true,
  videoUrl: true,
  readTimeMinutes: true,
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

@Injectable()
export class GuidesService {
  private readonly recentViews = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  // ==================== EDITORIAL CRUD & REVIEW WORKFLOW ====================

  async create(dto: CreateGuideDto, requester: AuthenticatedUser) {
    const canDirectPublish = EDITORIAL_REVIEWER_ROLES.has(requester.role);

    // 1. Validate category (must be active), species, and multiple breeds
    const uniqueBreedIds = await this.validateTaxonomy(
      dto.categoryId,
      dto.speciesId,
      dto.breedIds,
      true,
    );

    // 2. Generate & verify unique non-reserved slug
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    await this.ensureUniqueSlug(slug);

    // 3. Sanitize HTML, validate video URL, and compute readTimeMinutes
    const sanitizedContent = sanitizeGuideHtml(dto.content);
    const readTimeMinutes = calculateReadTimeMinutes(sanitizedContent);
    const validatedVideoUrl = validateExternalVideoUrl(dto.videoUrl);

    // 4. Enforce role rules on status & featured flag
    let targetStatus: GuideStatus = dto.status ?? GuideStatus.DRAFT;
    if (!canDirectPublish) {
      targetStatus =
        targetStatus === GuideStatus.PUBLISHED ||
        targetStatus === GuideStatus.IN_REVIEW
          ? GuideStatus.IN_REVIEW
          : GuideStatus.DRAFT;
    }

    const isFeatured = canDirectPublish ? Boolean(dto.isFeatured) : false;
    const now = new Date();
    const isPublishingNow = targetStatus === GuideStatus.PUBLISHED;
    const isVetPublishing = isPublishingNow && requester.role === 'VET';

    const guide = await this.prisma.guide.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        keyTakeaways:
          dto.keyTakeaways?.map((t) => t.trim()).filter(Boolean) ?? [],
        content: sanitizedContent,
        type: dto.type,
        coverImage: dto.coverImage?.trim() || null,
        coverImageAlt: dto.coverImageAlt?.trim() || null,
        videoUrl: validatedVideoUrl,
        readTimeMinutes,
        speciesId: dto.speciesId || null,
        breeds:
          uniqueBreedIds.length > 0
            ? { connect: uniqueBreedIds.map((id) => ({ id })) }
            : undefined,
        categoryId: dto.categoryId,
        tags: dto.tags?.map((t) => t.trim().toLowerCase()).filter(Boolean) ?? [],
        status: targetStatus,
        isFeatured,
        authorId: requester.userId,
        ...(isVetPublishing && {
          reviewerId: requester.userId,
          lastReviewedAt: now,
        }),
        metaTitle: dto.metaTitle?.trim() || null,
        metaDescription: dto.metaDescription?.trim() || null,
        publishedAt: isPublishingNow ? now : null,
        contentUpdatedAt: now,
      },
      include: {
        category: true,
        species: true,
        breeds: true,
        author: { select: { id: true, name: true, role: true } },
      },
    });

    // 5. Link cover image + inline paragraph images in MediaAsset (ownership-checked)
    await this.mediaService.syncGuideMedia(
      guide.id,
      guide.coverImage,
      guide.content,
      requester,
    );

    return guide;
  }

  async update(id: string, dto: UpdateGuideDto, requester: AuthenticatedUser) {
    const existing = await this.prisma.guide.findFirst({
      where: { id, deletedAt: null },
      include: { breeds: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Guide with ID ${id} not found`);
    }

    const canDirectPublish = EDITORIAL_REVIEWER_ROLES.has(requester.role);
    if (!canDirectPublish) {
      if (existing.authorId !== requester.userId) {
        throw new ForbiddenException('You can only edit your own guides');
      }
      if (
        existing.status === GuideStatus.PUBLISHED ||
        existing.status === GuideStatus.ARCHIVED
      ) {
        throw new ForbiddenException(
          'Published or archived guides are locked. Ask a Vet or Admin to return the guide for revision before editing.',
        );
      }
    }

    // 1. Validate taxonomy if any taxonomy field changed
    const nextCategoryId = dto.categoryId ?? existing.categoryId;
    const isChangingCategory = nextCategoryId !== existing.categoryId;
    const nextSpeciesId =
      dto.speciesId !== undefined ? dto.speciesId : existing.speciesId;
    const nextBreedIds =
      dto.breedIds !== undefined
        ? dto.breedIds
        : nextSpeciesId === existing.speciesId
          ? existing.breeds.map((b) => b.id)
          : []; // Clear old breeds if species was changed without passing new breedIds

    const uniqueBreedIds = await this.validateTaxonomy(
      nextCategoryId,
      nextSpeciesId,
      nextBreedIds,
      isChangingCategory,
    );

    // 2. Handle slug changes + preserve old published slug in previousSlugs
    let nextSlug: string | undefined;
    let updatedPreviousSlugs: string[] | undefined;

    if (dto.slug) {
      const candidateSlug = slugify(dto.slug);
      if (candidateSlug !== existing.slug) {
        await this.ensureUniqueSlug(candidateSlug, id);
        nextSlug = candidateSlug;

        if (existing.publishedAt) {
          const prevSet = new Set(existing.previousSlugs);
          prevSet.add(existing.slug);
          prevSet.delete(candidateSlug);
          updatedPreviousSlugs = Array.from(prevSet);
        }
      }
    }

    // 3. Sanitize content & recompute readTime if content changed
    let sanitizedContent: string | undefined;
    let readTimeMinutes: number | undefined;

    if (dto.content !== undefined) {
      sanitizedContent = sanitizeGuideHtml(dto.content);
      readTimeMinutes = calculateReadTimeMinutes(sanitizedContent);
    }

    const validatedVideoUrl =
      dto.videoUrl !== undefined
        ? validateExternalVideoUrl(dto.videoUrl)
        : undefined;

    // 4. Status transitions & author guardrails
    let nextStatus = dto.status ?? existing.status;
    if (!canDirectPublish) {
      if (
        nextStatus === GuideStatus.PUBLISHED ||
        nextStatus === GuideStatus.IN_REVIEW
      ) {
        nextStatus = GuideStatus.IN_REVIEW;
      } else if (!AUTHOR_ALLOWED_STATUSES.has(nextStatus)) {
        nextStatus = GuideStatus.DRAFT;
      }
    }

    const now = new Date();
    const isFirstTimePublish =
      nextStatus === GuideStatus.PUBLISHED && !existing.publishedAt;

    const didContentChange =
      dto.title !== undefined ||
      dto.excerpt !== undefined ||
      dto.content !== undefined ||
      dto.keyTakeaways !== undefined ||
      dto.coverImage !== undefined;

    // Clear stale expert-review badge if unverified edits move guide back to draft/review
    const shouldClearStaleReview =
      !canDirectPublish && didContentChange && existing.reviewerId !== null;

    const updated = await this.prisma.guide.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(nextSlug && { slug: nextSlug }),
        ...(updatedPreviousSlugs && { previousSlugs: updatedPreviousSlugs }),
        ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
        ...(dto.keyTakeaways !== undefined && {
          keyTakeaways: dto.keyTakeaways.map((t) => t.trim()).filter(Boolean),
        }),
        ...(sanitizedContent !== undefined && {
          content: sanitizedContent,
          readTimeMinutes,
        }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.coverImage !== undefined && {
          coverImage: dto.coverImage?.trim() || null,
        }),
        ...(dto.coverImageAlt !== undefined && {
          coverImageAlt: dto.coverImageAlt?.trim() || null,
        }),
        ...(validatedVideoUrl !== undefined && { videoUrl: validatedVideoUrl }),
        speciesId: nextSpeciesId || null,
        breeds: {
          set: uniqueBreedIds.map((breedId) => ({ id: breedId })),
        },
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.tags !== undefined && {
          tags: dto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
        }),
        status: nextStatus,
        ...(canDirectPublish &&
          dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.metaTitle !== undefined && {
          metaTitle: dto.metaTitle?.trim() || null,
        }),
        ...(dto.metaDescription !== undefined && {
          metaDescription: dto.metaDescription?.trim() || null,
        }),
        ...(isFirstTimePublish && { publishedAt: now }),
        ...(didContentChange && { contentUpdatedAt: now }),
        ...(shouldClearStaleReview && {
          reviewerId: null,
          lastReviewedAt: null,
        }),
      },
      include: {
        category: true,
        species: true,
        breeds: true,
        author: { select: { id: true, name: true, role: true } },
        reviewer: { select: { id: true, name: true, role: true } },
      },
    });

    // 5. Re-sync R2 media links if coverImage or HTML content changed
    if (dto.coverImage !== undefined || sanitizedContent !== undefined) {
      await this.mediaService.syncGuideMedia(
        updated.id,
        updated.coverImage,
        updated.content,
        requester,
      );
    }

    return updated;
  }

  // Vet / Admin Review Queue action (Publish, Request Revision, or Archive)
  async reviewGuide(
    id: string,
    dto: ReviewGuideDto,
    reviewer: AuthenticatedUser,
  ) {
    const guide = await this.prisma.guide.findFirst({
      where: { id, deletedAt: null },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with ID ${id} not found`);
    }

    if (
      dto.decision === ReviewDecision.NEEDS_REVISION &&
      (!dto.reviewNotes || dto.reviewNotes.trim() === '')
    ) {
      throw new BadRequestException(
        'reviewNotes are required when returning a guide for revision',
      );
    }

    const now = new Date();
    const markReviewed = dto.markExpertReviewed ?? true;

    const statusMap: Record<ReviewDecision, GuideStatus> = {
      [ReviewDecision.PUBLISH]: GuideStatus.PUBLISHED,
      [ReviewDecision.NEEDS_REVISION]: GuideStatus.NEEDS_REVISION,
      [ReviewDecision.ARCHIVE]: GuideStatus.ARCHIVED,
    };

    const nextStatus = statusMap[dto.decision];

    return this.prisma.guide.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewNotes: dto.reviewNotes?.trim() || null,
        ...(nextStatus === GuideStatus.PUBLISHED && {
          publishedAt: guide.publishedAt ?? now,
          ...(markReviewed && {
            reviewerId: reviewer.userId,
            lastReviewedAt: now,
          }),
        }),
      },
      select: guideSummarySelect,
    });
  }

  // Editorial list (Admin / Vet see all; Author sees only their own guides)
  async findAllEditorial(query: GuideQueryDto, requester: AuthenticatedUser) {
    const {
      page = 1,
      limit = 12,
      search,
      species,
      breed,
      category,
      type,
      status,
      isFeatured,
      authorId,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = query;

    const isReviewerOrAdmin = EDITORIAL_REVIEWER_ROLES.has(requester.role);
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(!isReviewerOrAdmin
        ? { authorId: requester.userId }
        : authorId
          ? { authorId }
          : {}),
      ...(status && { status }),
      ...(type && { type }),
      ...(isFeatured !== undefined && { isFeatured }),
    };

    if (species) {
      where.species = UUID_REGEX.test(species)
        ? { id: species }
        : { slug: species };
    }

    if (breed) {
      where.breeds = {
        some: UUID_REGEX.test(breed) ? { id: breed } : { slug: breed },
      };
    }

    if (category) {
      where.category = UUID_REGEX.test(category)
        ? { id: category }
        : { slug: category };
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.guide.findMany({
        where,
        select: {
          ...guideSummarySelect,
          reviewNotes: true,
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.guide.count({ where }),
    ]);

    return {
      items,
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

  // Editorial single guide fetch (includes full content + reviewNotes, without exposing private home address/email)
  async findOneEditorial(id: string, requester: AuthenticatedUser) {
    const guide = await this.prisma.guide.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        species: true,
        breeds: true,
        faqs: { orderBy: { displayOrder: 'asc' } },
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: {
              select: { avatar: true, specialization: true, bio: true },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: {
              select: { avatar: true, specialization: true, bio: true },
            },
          },
        },
      },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with ID ${id} not found`);
    }

    const isReviewerOrAdmin = EDITORIAL_REVIEWER_ROLES.has(requester.role);
    if (!isReviewerOrAdmin && guide.authorId !== requester.userId) {
      throw new ForbiddenException('Access denied to this draft');
    }

    return guide;
  }

  // Editorial Hub Dashboard Metrics
  async getEditorialStats() {
    const [
      publishedCount,
      inReviewCount,
      draftCount,
      needsRevisionCount,
      activeAuthorsCount,
      viewsAgg,
    ] = await Promise.all([
      this.prisma.guide.count({
        where: { status: GuideStatus.PUBLISHED, deletedAt: null },
      }),
      this.prisma.guide.count({
        where: { status: GuideStatus.IN_REVIEW, deletedAt: null },
      }),
      this.prisma.guide.count({
        where: { status: GuideStatus.DRAFT, deletedAt: null },
      }),
      this.prisma.guide.count({
        where: { status: GuideStatus.NEEDS_REVISION, deletedAt: null },
      }),
      this.prisma.user.count({
        where: {
          role: { in: ['AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN'] },
        },
      }),
      this.prisma.guide.aggregate({
        where: { deletedAt: null },
        _sum: { viewCount: true, likeCount: true, bookmarkCount: true },
      }),
    ]);

    return {
      publishedCount,
      inReviewCount,
      draftCount,
      needsRevisionCount,
      activeAuthorsCount,
      totalViews: viewsAgg._sum.viewCount ?? 0,
      totalLikes: viewsAgg._sum.likeCount ?? 0,
      totalBookmarks: viewsAgg._sum.bookmarkCount ?? 0,
    };
  }

  // Soft Delete (preserves SEO history & detaches media for orphan cleanup)
  async softDelete(id: string, requester: AuthenticatedUser) {
    const guide = await this.prisma.guide.findFirst({
      where: { id, deletedAt: null },
    });

    if (!guide) {
      throw new NotFoundException(`Guide with ID ${id} not found`);
    }

    const isAdmin =
      requester.role === 'ADMIN' || requester.role === 'SUPERADMIN';
    if (!isAdmin && guide.authorId !== requester.userId) {
      throw new ForbiddenException('You cannot delete this guide');
    }

    if (!isAdmin && guide.status === GuideStatus.PUBLISHED) {
      throw new ForbiddenException(
        'Only Admins can delete an already published guide',
      );
    }

    await this.prisma.guide.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: GuideStatus.ARCHIVED,
      },
    });

    await this.mediaService.detachGuideMedia(id);

    return { message: `Guide "${guide.title}" moved to trash` };
  }

  // ==================== PUBLIC EXPLORER, DETAIL & ENGAGEMENT ====================

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
          : { slug: category, isActive: true },
      });
    }

    // Species & Breed Smart Matching:
    // - If breed is selected: match guides tagged with that breed OR general species-wide guides (breeds is empty)
    // - If only species is selected: match guides for that species OR universal guides (speciesId: null)
    if (breed && breed !== 'all') {
      const breedFilter = UUID_REGEX.test(breed) ? { id: breed } : { slug: breed };
      const targetBreed = await this.prisma.petBreed.findUnique({
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
        : { slug: species };
      andConditions.push({
        OR: [{ species: speciesFilter }, { speciesId: null }],
      });
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
        orderBy: { [sortBy]: sortOrder },
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

  // Concurrency-safe Toggle Like (exact COUNT sync without mutating Guide @updatedAt)
  async toggleLike(guideId: string, userId: string) {
    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId, status: GuideStatus.PUBLISHED, deletedAt: null },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException('Published guide not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.guideLike.deleteMany({
        where: { userId, guideId },
      });

      let liked = false;
      if (deleted.count === 0) {
        await tx.guideLike.createMany({
          data: [{ userId, guideId }],
          skipDuplicates: true,
        });
        liked = true;
      }

      const rows = await tx.$queryRaw<{ likeCount: number }[]>`
        UPDATE "Guide"
        SET "likeCount" = (
          SELECT COUNT(*)::int FROM "GuideLike" WHERE "guideId" = ${guideId}
        )
        WHERE "id" = ${guideId}
        RETURNING "likeCount"
      `;

      return {
        liked,
        likeCount: rows[0]?.likeCount ?? 0,
      };
    });
  }

  // Concurrency-safe Toggle Bookmark (exact COUNT sync without mutating Guide @updatedAt)
  async toggleBookmark(guideId: string, userId: string) {
    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId, status: GuideStatus.PUBLISHED, deletedAt: null },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException('Published guide not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.guideBookmark.deleteMany({
        where: { userId, guideId },
      });

      let bookmarked = false;
      if (deleted.count === 0) {
        await tx.guideBookmark.createMany({
          data: [{ userId, guideId }],
          skipDuplicates: true,
        });
        bookmarked = true;
      }

      const rows = await tx.$queryRaw<{ bookmarkCount: number }[]>`
        UPDATE "Guide"
        SET "bookmarkCount" = (
          SELECT COUNT(*)::int FROM "GuideBookmark" WHERE "guideId" = ${guideId}
        )
        WHERE "id" = ${guideId}
        RETURNING "bookmarkCount"
      `;

      return {
        bookmarked,
        bookmarkCount: rows[0]?.bookmarkCount ?? 0,
      };
    });
  }

  // Logged-in User's Saved / Bookmarked Guides (hydrates both isBookmarked & isLiked)
  async getMyBookmarks(userId: string, page = 1, limit = 12) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));
    const skip = (safePage - 1) * safeLimit;

    const where = {
      userId,
      guide: {
        status: GuideStatus.PUBLISHED,
        deletedAt: null,
      },
    };

    const [bookmarks, total] = await Promise.all([
      this.prisma.guideBookmark.findMany({
        where,
        include: {
          guide: {
            select: {
              ...guideSummarySelect,
              likes: { where: { userId }, select: { id: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.guideBookmark.count({ where }),
    ]);

    return {
      items: bookmarks.map((b: any) => {
        const { likes, ...guideRest } = b.guide;
        return {
          bookmarkedAt: b.createdAt,
          ...guideRest,
          isLiked: Boolean(likes?.length),
          isBookmarked: true,
        };
      }),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        hasNextPage: safePage * safeLimit < total,
        hasPrevPage: safePage > 1,
      },
    };
  }

  // ==================== VALIDATION HELPERS ====================

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

  private async validateTaxonomy(
    categoryId: string,
    speciesId?: string | null,
    breedIds?: string[],
    requireActiveCategory = false,
  ): Promise<string[]> {
    const category = await this.prisma.guideCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException('Selected GuideCategory does not exist');
    }
    if (requireActiveCategory && !category.isActive) {
      throw new BadRequestException(
        `Category "${category.name}" is inactive and cannot be assigned to new guides`,
      );
    }

    if (speciesId) {
      const species = await this.prisma.petSpecies.findUnique({
        where: { id: speciesId },
      });
      if (!species) {
        throw new BadRequestException('Selected PetSpecies does not exist');
      }
    }

    const uniqueBreedIds = Array.from(new Set(breedIds ?? []));
    if (uniqueBreedIds.length > 0) {
      if (!speciesId) {
        throw new BadRequestException(
          'Cannot assign breeds without selecting a parent speciesId',
        );
      }

      const foundBreeds = await this.prisma.petBreed.findMany({
        where: { id: { in: uniqueBreedIds } },
        select: { id: true, name: true, speciesId: true },
      });

      if (foundBreeds.length !== uniqueBreedIds.length) {
        throw new BadRequestException('One or more selected breedIds do not exist');
      }

      const mismatched = foundBreeds.find((b) => b.speciesId !== speciesId);
      if (mismatched) {
        throw new BadRequestException(
          `Breed "${mismatched.name}" does not belong to the selected species`,
        );
      }
    }

    return uniqueBreedIds;
  }

  private async ensureUniqueSlug(slug: string, excludeGuideId?: string) {
    if (!slug) {
      throw new BadRequestException(
        'Guide title or slug must contain valid letters or numbers',
      );
    }

    if (RESERVED_GUIDE_SLUGS.has(slug)) {
      throw new BadRequestException(
        `Guide slug "${slug}" is reserved. Please choose a more descriptive slug.`,
      );
    }

    const conflict = await this.prisma.guide.findFirst({
      where: {
        OR: [{ slug }, { previousSlugs: { has: slug } }],
        ...(excludeGuideId ? { NOT: { id: excludeGuideId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException(`Guide slug "${slug}" is already in use`);
    }
  }
}
