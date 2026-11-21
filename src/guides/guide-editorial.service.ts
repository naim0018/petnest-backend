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
import { GuideCategoriesService } from './guide-categories.service';
import {
  calculateReadTimeMinutes,
  sanitizeGuideHtml,
  validateExternalVideoUrl,
} from './utils/guide-content.util';
import * as path from 'path';
import { extractZipInMemory } from 'src/common/utils/zip.util';
import {
  BulkImportGuideItem,
  BulkImportGuideResult,
  BulkImportZipResponse,
} from './dto/bulk-import-guide.dto';
import {
  AUTHOR_ALLOWED_STATUSES,
  EDITORIAL_REVIEWER_ROLES,
  RESERVED_GUIDE_SLUGS,
  guideSummarySelect,
  slugify,
} from './constants/guide.constants';

@Injectable()
export class GuideEditorialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly guideCategoriesService: GuideCategoriesService,
  ) {}

  // ==================== EDITORIAL CRUD & REVIEW WORKFLOW ====================

  async create(dto: CreateGuideDto, requester: AuthenticatedUser) {
    const canDirectPublish = EDITORIAL_REVIEWER_ROLES.has(requester.role);

    const resolvedCategoryId =
      dto.categoryId ||
      (await this.guideCategoriesService.ensureDefaultBasicCategory()).id;

    // 1. Validate category (must be active), species, and multiple breeds
    const uniqueBreedIds = await this.validateTaxonomy(
      resolvedCategoryId,
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
        faqImage: dto.faqImage?.trim() || null,
        videoUrl: validatedVideoUrl,
        readTimeMinutes,
        displayOrder: dto.displayOrder ?? 0,
        speciesId: dto.speciesId || null,
        breeds:
          uniqueBreedIds.length > 0
            ? { connect: uniqueBreedIds.map((id) => ({ id })) }
            : undefined,
        categoryId: resolvedCategoryId,
        tags:
          dto.tags?.map((t) => t.trim().toLowerCase()).filter(Boolean) ?? [],
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

    // 5. Link cover image + FAQ image + inline paragraph images in MediaAsset (ownership-checked)
    await this.mediaService.syncGuideMedia(
      guide.id,
      guide.coverImage,
      guide.content,
      requester,
      [guide.faqImage],
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
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.faqImage !== undefined && {
          faqImage: dto.faqImage?.trim() || null,
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

    // 5. Re-sync R2 media links if coverImage, faqImage, or HTML content changed
    if (
      dto.coverImage !== undefined ||
      dto.faqImage !== undefined ||
      sanitizedContent !== undefined
    ) {
      await this.mediaService.syncGuideMedia(
        updated.id,
        updated.coverImage,
        updated.content,
        requester,
        [updated.faqImage],
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
        orderBy:
          sortBy === 'displayOrder'
            ? [{ displayOrder: sortOrder }, { updatedAt: 'desc' as const }]
            : { [sortBy]: sortOrder },
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      publishedCount,
      inReviewCount,
      draftCount,
      needsRevisionCount,
      archivedCount,
      publishedThisMonth,
      activeAuthorsCount,
      faqCount,
      categoriesList,
      viewsAgg,
      recentGuidesTimeline,
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
      this.prisma.guide.count({
        where: { status: GuideStatus.ARCHIVED, deletedAt: null },
      }),
      this.prisma.guide.count({
        where: {
          status: GuideStatus.PUBLISHED,
          deletedAt: null,
          publishedAt: { gte: startOfMonth },
        },
      }),
      this.prisma.user.count({
        where: {
          role: { in: ['AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN'] },
        },
      }),
      this.prisma.guideFaq.count({
        where: { isActive: true },
      }),
      this.prisma.guideCategory.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          guides: {
            where: { deletedAt: null },
            select: { id: true, viewCount: true },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.guide.aggregate({
        where: { deletedAt: null },
        _sum: { viewCount: true, likeCount: true, bookmarkCount: true },
        _avg: { readTimeMinutes: true },
      }),
      this.prisma.guide.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          createdAt: true,
          viewCount: true,
          likeCount: true,
          status: true,
        },
      }),
    ]);

    const totalGuides =
      publishedCount +
      inReviewCount +
      draftCount +
      needsRevisionCount +
      archivedCount;

    // Build 6-month monthly timeline
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyTrend: {
      month: string;
      label: string;
      year: number;
      published: number;
      views: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const key = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
      const label = monthNames[mIdx];

      const inMonth = recentGuidesTimeline.filter((g) => {
        const gd = new Date(g.createdAt);
        return gd.getFullYear() === y && gd.getMonth() === mIdx;
      });

      const published = inMonth.filter(
        (g) => g.status === GuideStatus.PUBLISHED,
      ).length;
      const views = inMonth.reduce((acc, g) => acc + (g.viewCount || 0), 0);

      monthlyTrend.push({
        month: key,
        label,
        year: y,
        published,
        views,
      });
    }

    // Category distribution for bar chart
    const categoryDistribution = categoriesList.map((cat) => ({
      name: cat.name,
      guideCount: cat.guides.length,
      views: cat.guides.reduce((acc, g) => acc + (g.viewCount || 0), 0),
    }));

    // Status breakdown for donut/pie chart
    const statusDistribution = [
      {
        name: 'Published',
        value: publishedCount,
        color: '#10B981',
        status: 'PUBLISHED',
      },
      {
        name: 'In Review',
        value: inReviewCount,
        color: '#38BDF8',
        status: 'IN_REVIEW',
      },
      {
        name: 'Draft',
        value: draftCount,
        color: '#94A3B8',
        status: 'DRAFT',
      },
      {
        name: 'Needs Revision',
        value: needsRevisionCount,
        color: '#F59E0B',
        status: 'NEEDS_REVISION',
      },
      {
        name: 'Archived',
        value: archivedCount,
        color: '#64748B',
        status: 'ARCHIVED',
      },
    ];

    return {
      publishedCount,
      inReviewCount,
      draftCount,
      needsRevisionCount,
      archivedCount,
      totalGuides,
      publishedThisMonth,
      activeAuthorsCount,
      faqCount,
      avgReadTimeMinutes: Math.round(viewsAgg._avg.readTimeMinutes || 5),
      totalViews: viewsAgg._sum.viewCount ?? 0,
      totalLikes: viewsAgg._sum.likeCount ?? 0,
      totalBookmarks: viewsAgg._sum.bookmarkCount ?? 0,
      monthlyTrend,
      categoryDistribution,
      statusDistribution,
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

  // ==================== BULK IMPORT (.ZIP) WORKFLOW ====================

  async bulkImportFromZip(
    zipBuffer: Buffer,
    requester: AuthenticatedUser,
  ): Promise<BulkImportZipResponse> {
    if (!zipBuffer || zipBuffer.length === 0) {
      throw new BadRequestException(
        'A non-empty .zip file is required for bulk import',
      );
    }

    // 1. Unzip archive in memory
    const extractedFiles = extractZipInMemory(zipBuffer);

    // 2. Locate guides.json or guide.json
    let jsonBuffer: Buffer | undefined;
    for (const [filePath, buf] of extractedFiles.entries()) {
      if (/(?:^|\/)guides?\.json$/i.test(filePath)) {
        jsonBuffer = buf;
        break;
      }
    }

    if (!jsonBuffer) {
      throw new BadRequestException(
        'Could not find guides.json (or guide.json) in the uploaded .zip archive',
      );
    }

    if (jsonBuffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'The guides.json file exceeds the maximum allowable size of 5MB',
      );
    }

    let parsedData: any;
    try {
      let rawJson = jsonBuffer.toString('utf8');
      if (rawJson.charCodeAt(0) === 0xfeff) {
        rawJson = rawJson.slice(1);
      }
      parsedData = JSON.parse(rawJson);
    } catch (err: any) {
      throw new BadRequestException(
        `Invalid JSON syntax in guides.json: ${err?.message || 'Check JSON formatting'}`,
      );
    }

    const guidesArray: BulkImportGuideItem[] = Array.isArray(parsedData)
      ? parsedData
      : [parsedData];

    if (guidesArray.length === 0) {
      throw new BadRequestException(
        'The guides.json file does not contain any guides',
      );
    }

    const MAX_GUIDES_PER_IMPORT = 50;
    if (guidesArray.length > MAX_GUIDES_PER_IMPORT) {
      throw new BadRequestException(
        `Bulk import exceeds maximum allowed limit of ${MAX_GUIDES_PER_IMPORT} guides per archive to prevent timeouts`,
      );
    }

    // 3. Extract & upload all image files from the archive
    const imageMap = new Map<string, string>();
    const IMAGE_EXTENSIONS = new Set([
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.avif',
      '.gif',
    ]);

    let uploadedImagesCount = 0;
    for (const [filePath, fileBuf] of extractedFiles.entries()) {
      const ext = path.extname(filePath).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        try {
          const originalBaseName = path.basename(filePath);
          const uploaded = await this.mediaService.uploadImageBuffer(
            fileBuf,
            requester.userId,
            'guides',
            originalBaseName,
          );

          const uploadedUrl = uploaded.url;
          uploadedImagesCount++;

          // Register in imageMap by multiple keys for ultra-flexible lookup
          imageMap.set(filePath, uploadedUrl);
          imageMap.set(filePath.toLowerCase(), uploadedUrl);
          imageMap.set(originalBaseName, uploadedUrl);
          imageMap.set(originalBaseName.toLowerCase(), uploadedUrl);
          imageMap.set(`images/${originalBaseName}`, uploadedUrl);
          imageMap.set(`images/${originalBaseName}`.toLowerCase(), uploadedUrl);

          const withoutLeadingImages = filePath.replace(/^images\//i, '');
          imageMap.set(withoutLeadingImages, uploadedUrl);
          imageMap.set(withoutLeadingImages.toLowerCase(), uploadedUrl);
        } catch (imgErr) {
          console.error(
            `Bulk import: Failed to upload image ${filePath}:`,
            imgErr,
          );
        }
      }
    }

    const resolveImageUrl = (ref?: string | null): string | null => {
      if (!ref || typeof ref !== 'string') return null;
      const trimmed = ref.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;

      const baseName = path.basename(trimmed);
      return (
        imageMap.get(trimmed) ||
        imageMap.get(trimmed.toLowerCase()) ||
        imageMap.get(baseName) ||
        imageMap.get(baseName.toLowerCase()) ||
        imageMap.get(`images/${baseName}`) ||
        imageMap.get(`images/${baseName}`.toLowerCase()) ||
        trimmed
      );
    };

    // Preload categories, species, and breeds for fast, low-overhead lookup
    const allCategories = await this.prisma.guideCategory.findMany({
      where: { isActive: true },
    });
    const defaultBasicCategory =
      await this.guideCategoriesService.ensureDefaultBasicCategory();

    const allSpecies = await this.prisma.petSpecies.findMany({
      include: { breeds: true },
    });

    const canDirectPublish = EDITORIAL_REVIEWER_ROLES.has(requester.role);
    const results: BulkImportGuideResult[] = [];

    // 4. Process each guide sequentially
    for (let i = 0; i < guidesArray.length; i++) {
      const guide = guidesArray[i];
      const guideTitle = guide?.title?.trim() || `Guide #${i + 1}`;

      try {
        if (!guide || typeof guide !== 'object') {
          throw new BadRequestException(
            'Guide entry is not a valid JSON object',
          );
        }

        if (!guide.title || guide.title.trim().length < 5) {
          throw new BadRequestException(
            'Title is required and must be at least 5 characters',
          );
        }

        const excerpt = (guide.summary || guide.excerpt || '').trim();
        if (!excerpt || excerpt.length < 10) {
          throw new BadRequestException(
            'Summary / excerpt is required and must be at least 10 characters',
          );
        }

        // Category resolution
        let resolvedCategoryId = defaultBasicCategory.id;
        if (guide.categoryId) {
          const found = allCategories.find((c) => c.id === guide.categoryId);
          if (found) resolvedCategoryId = found.id;
        } else if (guide.category) {
          const query = guide.category.trim().toLowerCase();
          const found = allCategories.find(
            (c) =>
              c.name.toLowerCase() === query || c.slug.toLowerCase() === query,
          );
          if (found) resolvedCategoryId = found.id;
        }

        // Species resolution
        let resolvedSpeciesId: string | null = null;
        let matchingSpecies: (typeof allSpecies)[0] | undefined;
        if (guide.speciesId) {
          matchingSpecies = allSpecies.find((s) => s.id === guide.speciesId);
          if (matchingSpecies) resolvedSpeciesId = matchingSpecies.id;
        } else if (guide.species) {
          const sQuery = guide.species.trim().toLowerCase();
          matchingSpecies = allSpecies.find(
            (s) =>
              s.name.toLowerCase() === sQuery ||
              s.slug.toLowerCase() === sQuery,
          );
          if (matchingSpecies) resolvedSpeciesId = matchingSpecies.id;
        }

        // Breeds resolution
        const resolvedBreedIds: string[] = [];
        if (matchingSpecies) {
          if (Array.isArray(guide.breedIds)) {
            for (const bId of guide.breedIds) {
              if (matchingSpecies.breeds.some((b) => b.id === bId)) {
                resolvedBreedIds.push(bId);
              }
            }
          } else if (Array.isArray(guide.breeds)) {
            for (const bRef of guide.breeds) {
              const bQuery = bRef.trim().toLowerCase();
              const match = matchingSpecies.breeds.find(
                (b) =>
                  b.name.toLowerCase() === bQuery ||
                  b.slug.toLowerCase() === bQuery ||
                  b.id === bRef,
              );
              if (match && !resolvedBreedIds.includes(match.id)) {
                resolvedBreedIds.push(match.id);
              }
            }
          }
        }

        // Assemble Content (sections[] + body + tokens) in clean Markdown
        let assembled = '';
        let imagesLinked = 0;

        if (Array.isArray(guide.sections) && guide.sections.length > 0) {
          for (const sec of guide.sections) {
            if (sec.heading) {
              assembled += `\n\n## ${sec.heading.trim()}\n\n`;
            }
            if (sec.image) {
              const imgUrl = resolveImageUrl(sec.image);
              if (imgUrl) {
                imagesLinked++;
                const caption = (sec.imageCaption || sec.caption || '').trim();
                assembled += `![${caption || sec.heading || 'Guide illustration'}](${imgUrl})\n\n`;
              }
            }
            if (sec.body) {
              assembled += `${this.convertHtmlToMarkdown(sec.body.trim())}\n\n`;
            }
          }
        }

        if (guide.content || guide.body) {
          const extra = (guide.content || guide.body || '').trim();
          const extraMd = this.convertHtmlToMarkdown(extra);
          assembled = assembled ? `${assembled}\n\n${extraMd}` : extraMd;
        }

        if (!assembled || assembled.length < 30) {
          throw new BadRequestException(
            'Guide content or sections are required (minimum 30 characters of text)',
          );
        }

        if (assembled.length > 150000) {
          throw new BadRequestException(
            `Assembled guide content (${assembled.length} characters) exceeds the 150,000 character maximum limit`,
          );
        }

        // Replace inline {{image:filename.ext}} tokens with markdown image
        assembled = assembled.replace(
          /\{\{image:([^}]+)\}\}/gi,
          (_, fileName) => {
            const trimmed = fileName.trim();
            const imgUrl = resolveImageUrl(trimmed);
            if (imgUrl) {
              imagesLinked++;
              return `\n\n![${trimmed}](${imgUrl})\n\n`;
            }
            return '';
          },
        );

        // Replace markdown images ![alt](filename.ext)
        assembled = assembled.replace(
          /!\[(.*?)\]\((.*?)\)/g,
          (match, altText, src) => {
            if (/^https?:\/\//i.test(src)) return match;
            const mapped = resolveImageUrl(src);
            if (mapped) {
              imagesLinked++;
              return `![${altText}](${mapped})`;
            }
            return match;
          },
        );

        // Replace any remaining HTML <img> tags with markdown image
        assembled = assembled.replace(
          /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi,
          (match, src, alt) => {
            const mapped = resolveImageUrl(src) || src;
            if (mapped !== src) imagesLinked++;
            return `![${(alt || '').trim()}](${mapped})`;
          },
        );

        // Normalize spacing
        assembled = assembled
          .replace(/\r\n/g, '\n')
          .replace(/[ \t]+$/gm, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        // Sanitize assembled content
        const sanitizedContent = sanitizeGuideHtml(assembled);

        // Calculate read time
        const readTimeMinutes =
          typeof guide.readTime === 'number' && guide.readTime > 0
            ? Math.round(guide.readTime)
            : typeof guide.readTimeMinutes === 'number' &&
                guide.readTimeMinutes > 0
              ? Math.round(guide.readTimeMinutes)
              : calculateReadTimeMinutes(sanitizedContent);

        // Cover and FAQ images
        const resolvedCoverImage = resolveImageUrl(
          guide.heroImage || guide.coverImage,
        );
        const resolvedFaqImage = resolveImageUrl(guide.faqImage);
        if (resolvedCoverImage) imagesLinked++;
        if (resolvedFaqImage) imagesLinked++;

        // Slug generation
        const baseSlug = guide.slug
          ? slugify(guide.slug)
          : slugify(guide.title);
        const uniqueSlug = await this.generateUniqueBulkSlug(baseSlug);

        // Target Status
        let targetStatus: GuideStatus = GuideStatus.DRAFT;
        const requestedStatus = (guide.status || '').toUpperCase();
        if (requestedStatus === 'PUBLISHED') {
          targetStatus = canDirectPublish
            ? GuideStatus.PUBLISHED
            : GuideStatus.IN_REVIEW;
        } else if (requestedStatus === 'IN_REVIEW') {
          targetStatus = GuideStatus.IN_REVIEW;
        } else if (requestedStatus === 'ARCHIVED' && canDirectPublish) {
          targetStatus = GuideStatus.ARCHIVED;
        } else if (requestedStatus === 'NEEDS_REVISION' && canDirectPublish) {
          targetStatus = GuideStatus.NEEDS_REVISION;
        }

        const now = new Date();
        const isPublishingNow = targetStatus === GuideStatus.PUBLISHED;
        const isVetPublishing = isPublishingNow && requester.role === 'VET';

        // Display order
        const displayOrder =
          typeof guide.displayOrder === 'number'
            ? Math.max(0, Math.round(guide.displayOrder))
            : typeof guide.order === 'number'
              ? Math.max(0, Math.round(guide.order))
              : 0;

        // Create Guide and FAQs atomically within a database transaction
        let faqsCount = 0;
        const createdGuide = await this.prisma.$transaction(async (tx) => {
          const newGuide = await tx.guide.create({
            data: {
              title: guide.title.trim(),
              slug: uniqueSlug,
              excerpt,
              keyTakeaways: Array.isArray(guide.keyTakeaways)
                ? guide.keyTakeaways
                    .map((t) => String(t).trim())
                    .filter(Boolean)
                : [],
              content: sanitizedContent,
              type: guide.type || 'ARTICLE',
              coverImage: resolvedCoverImage,
              coverImageAlt: guide.coverImageAlt?.trim() || null,
              faqImage: resolvedFaqImage,
              videoUrl: validateExternalVideoUrl(guide.videoUrl),
              readTimeMinutes,
              displayOrder,
              speciesId: resolvedSpeciesId,
              breeds:
                resolvedBreedIds.length > 0
                  ? { connect: resolvedBreedIds.map((id) => ({ id })) }
                  : undefined,
              categoryId: resolvedCategoryId,
              tags: Array.isArray(guide.tags)
                ? guide.tags
                    .map((t) => String(t).trim().toLowerCase())
                    .filter(Boolean)
                : [],
              status: targetStatus,
              isFeatured: canDirectPublish ? Boolean(guide.isFeatured) : false,
              authorId: requester.userId,
              ...(isVetPublishing && {
                reviewerId: requester.userId,
                lastReviewedAt: now,
              }),
              metaTitle: guide.metaTitle?.trim() || null,
              metaDescription: guide.metaDescription?.trim() || null,
              publishedAt: isPublishingNow ? now : null,
              contentUpdatedAt: now,
            },
          });

          if (Array.isArray(guide.faqs) && guide.faqs.length > 0) {
            const faqData = guide.faqs
              .filter(
                (f) => f && typeof f === 'object' && f.question && f.answer,
              )
              .map((f, fIdx) => ({
                guideId: newGuide.id,
                question: f.question.trim(),
                answer: f.answer.trim(),
                displayOrder:
                  typeof f.displayOrder === 'number'
                    ? Math.max(0, f.displayOrder)
                    : fIdx,
                isActive: typeof f.isActive === 'boolean' ? f.isActive : true,
              }));

            if (faqData.length > 0) {
              await tx.guideFaq.createMany({ data: faqData });
              faqsCount = faqData.length;
            }
          }

          return newGuide;
        });

        // Link media assets
        await this.mediaService.syncGuideMedia(
          createdGuide.id,
          createdGuide.coverImage,
          createdGuide.content,
          requester,
          [createdGuide.faqImage],
        );

        results.push({
          index: i + 1,
          id: createdGuide.id,
          title: createdGuide.title,
          slug: createdGuide.slug,
          status: createdGuide.status,
          faqsCount,
          imagesLinked,
          success: true,
        });
      } catch (err: any) {
        console.error(
          `Bulk import guide #${i + 1} ("${guideTitle}") failed:`,
          err,
        );
        results.push({
          index: i + 1,
          title: guideTitle,
          faqsCount: 0,
          imagesLinked: 0,
          success: false,
          error: err?.message || 'Unknown processing error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return {
      success: successCount > 0,
      message: `Bulk import completed: ${successCount} guide${successCount === 1 ? '' : 's'} imported, ${failureCount} failed.`,
      totalProcessed: results.length,
      successCount,
      failureCount,
      uploadedImagesCount,
      results,
    };
  }

  // ==================== VALIDATION HELPERS ====================

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
        throw new BadRequestException(
          'One or more selected breedIds do not exist',
        );
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

  private convertHtmlToMarkdown(text: string): string {
    if (!text) return '';
    let md = text;

    if (
      !/<\/?(h[1-6]|p|div|ul|ol|li|table|tr|td|th|blockquote|strong|b|em|i|hr|br|figure|figcaption|section|article|aside|a|img)[\s/>]/i.test(
        md,
      )
    ) {
      return md.trim();
    }

    // Replace figure and image tags FIRST (capturing alt/caption)
    md = md.replace(
      /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>[\s\S]*?(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/gi,
      (_, src, alt, caption) => {
        const cap = (caption || alt || '').trim();
        return `\n\n![${cap}](${src})\n\n`;
      },
    );
    md = md.replace(
      /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi,
      (_, src, alt) => `\n\n![${(alt || '').trim()}](${src})\n\n`,
    );

    // Replace headings
    md = md.replace(/<h[1-2][^>]*>(.*?)<\/h[1-2]>/gi, '\n\n## $1\n\n');
    md = md.replace(/<h[3-6][^>]*>(.*?)<\/h[3-6]>/gi, '\n\n### $1\n\n');

    // Replace bold & italic
    md = md.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**');
    md = md.replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*');

    // Replace list items
    md = md.replace(
      /<li[^>]*>(.*?)<\/li>/gi,
      (_, item) => `\n- ${item.trim()}`,
    );
    md = md.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');

    // Replace paragraphs and line breaks
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining container tags like div, span, etc.
    md = md.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    md = md
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    return md
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async generateUniqueBulkSlug(baseSlug: string): Promise<string> {
    let candidate = baseSlug || 'guide';
    let counter = 1;

    while (true) {
      if (RESERVED_GUIDE_SLUGS.has(candidate)) {
        counter++;
        candidate = `${baseSlug || 'guide'}-${counter}`;
        continue;
      }

      const existing = await this.prisma.guide.findFirst({
        where: {
          OR: [{ slug: candidate }, { previousSlugs: { has: candidate } }],
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      counter++;
      candidate = `${baseSlug || 'guide'}-${counter}`;
    }
  }
}
