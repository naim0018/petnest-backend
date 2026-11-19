import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { UUID_REGEX } from 'src/common/utils/validation.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGuideCategoryDto } from './dto/create-category.dto';
import { UpdateGuideCategoryDto } from './dto/update-category.dto';

export const DEFAULT_BASIC_CATEGORY_SLUG = 'basic';
export const DEFAULT_BASIC_CATEGORY_DATA = {
  name: 'Basic',
  slug: DEFAULT_BASIC_CATEGORY_SLUG,
  description:
    'Default foundational pet care guides displayed at the top without topic filters across all species and general guides.',
  icon: 'BookOpen',
  displayOrder: -1,
  isActive: true,
};

const RESERVED_CATEGORY_SLUGS = new Set(['all', 'admin', DEFAULT_BASIC_CATEGORY_SLUG]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class GuideCategoriesService implements OnModuleInit {
  private defaultBasicEnsured = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultBasicCategory();
  }

  async ensureDefaultBasicCategory() {
    const existing = await this.prisma.guideCategory.findFirst({
      where: {
        OR: [
          { slug: DEFAULT_BASIC_CATEGORY_SLUG },
          { name: { equals: DEFAULT_BASIC_CATEGORY_DATA.name, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      this.defaultBasicEnsured = true;
      if (
        !existing.isActive ||
        existing.displayOrder > DEFAULT_BASIC_CATEGORY_DATA.displayOrder ||
        existing.slug !== DEFAULT_BASIC_CATEGORY_SLUG
      ) {
        return this.prisma.guideCategory.update({
          where: { id: existing.id },
          data: {
            slug: DEFAULT_BASIC_CATEGORY_SLUG,
            isActive: true,
            displayOrder: DEFAULT_BASIC_CATEGORY_DATA.displayOrder,
          },
        });
      }
      return existing;
    }

    const created = await this.prisma.guideCategory.create({
      data: DEFAULT_BASIC_CATEGORY_DATA,
    });
    this.defaultBasicEnsured = true;
    return created;
  }

  async create(dto: CreateGuideCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);

    if (!slug) {
      throw new BadRequestException(
        'Category name or slug must contain valid letters or numbers',
      );
    }

    if (RESERVED_CATEGORY_SLUGS.has(slug)) {
      throw new BadRequestException(`Category slug "${slug}" is reserved`);
    }

    const existing = await this.prisma.guideCategory.findFirst({
      where: {
        OR: [
          { name: { equals: dto.name, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.slug.toLowerCase() === slug.toLowerCase()
          ? `Category slug "${slug}" is already in use`
          : `Category "${dto.name}" already exists`,
      );
    }

    return this.prisma.guideCategory.create({
      data: {
        ...dto,
        slug,
      },
    });
  }

  // Public: Only active categories + published guide count
  async findAllPublic(excludeBasic = false) {
    if (!this.defaultBasicEnsured) {
      await this.ensureDefaultBasicCategory();
    }

    return this.prisma.guideCategory.findMany({
      where: {
        isActive: true,
        ...(excludeBasic && { slug: { not: DEFAULT_BASIC_CATEGORY_SLUG } }),
      },
      include: {
        _count: {
          select: {
            guides: {
              where: { status: 'PUBLISHED', deletedAt: null },
            },
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // Admin: All categories + guide count + total views per category
  async findAllAdmin(search?: string) {
    if (!this.defaultBasicEnsured) {
      await this.ensureDefaultBasicCategory();
    }

    const trimmed = search?.trim().slice(0, 100);

    const categories = await this.prisma.guideCategory.findMany({
      where: trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: 'insensitive' } },
              { slug: { contains: trimmed, mode: 'insensitive' } },
              { description: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        guides: {
          where: { deletedAt: null },
          select: { viewCount: true },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map(({ guides, ...cat }) => ({
      ...cat,
      guidesCount: guides.length,
      totalViews: guides.reduce((sum, g) => sum + g.viewCount, 0),
    }));
  }

  async findOne(idOrSlug: string) {
    const isId = UUID_REGEX.test(idOrSlug);

    const category = await this.prisma.guideCategory.findUnique({
      where: isId ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        _count: {
          select: {
            guides: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Guide category "${idOrSlug}" not found`);
    }

    return category;
  }

  async update(id: string, dto: UpdateGuideCategoryDto) {
    const existing = await this.findOne(id);
    const isDefaultBasic = existing.slug === DEFAULT_BASIC_CATEGORY_SLUG;

    if (isDefaultBasic && dto.isActive === false) {
      throw new BadRequestException(
        'Cannot deactivate the default "Basic" category.',
      );
    }

    const newSlug = dto.slug
      ? slugify(dto.slug)
      : dto.name && !isDefaultBasic
        ? slugify(dto.name)
        : undefined;

    if (newSlug !== undefined) {
      if (!newSlug) {
        throw new BadRequestException(
          'Category name or slug must contain valid letters or numbers',
        );
      }
      if (isDefaultBasic && newSlug !== DEFAULT_BASIC_CATEGORY_SLUG) {
        throw new BadRequestException(
          'Cannot change the slug of the default "Basic" category.',
        );
      }
      if (!isDefaultBasic && RESERVED_CATEGORY_SLUGS.has(newSlug)) {
        throw new BadRequestException(`Category slug "${newSlug}" is reserved`);
      }
    }

    if (dto.name || newSlug) {
      const duplicate = await this.prisma.guideCategory.findFirst({
        where: {
          OR: [
            ...(dto.name
              ? [{ name: { equals: dto.name, mode: 'insensitive' as const } }]
              : []),
            ...(newSlug
              ? [{ slug: { equals: newSlug, mode: 'insensitive' as const } }]
              : []),
          ],
          NOT: { id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          newSlug && duplicate.slug.toLowerCase() === newSlug.toLowerCase()
            ? `Category slug "${newSlug}" is already in use`
            : `Category "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.guideCategory.update({
      where: { id },
      data: {
        ...dto,
        ...(isDefaultBasic
          ? {
              slug: DEFAULT_BASIC_CATEGORY_SLUG,
              displayOrder: DEFAULT_BASIC_CATEGORY_DATA.displayOrder,
              isActive: true,
            }
          : newSlug
            ? { slug: newSlug }
            : {}),
      },
    });
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    if (category.slug === DEFAULT_BASIC_CATEGORY_SLUG) {
      throw new BadRequestException(
        'Cannot delete the default "Basic" category.',
      );
    }

    const attachedGuidesCount = await this.prisma.guide.count({
      where: { categoryId: id },
    });

    if (attachedGuidesCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${category.name}" because ${attachedGuidesCount} guide(s) belong to it. Reassign those guides or set isActive to false instead.`,
      );
    }

    await this.prisma.guideCategory.delete({ where: { id } });
    return { message: `Category "${category.name}" deleted successfully` };
  }
}
