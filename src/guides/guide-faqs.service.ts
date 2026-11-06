import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuideStatus } from 'prisma/generated/prisma/enums';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { UUID_REGEX } from 'src/common/utils/validation.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGuideFaqDto } from './dto/create-faq.dto';
import { UpdateGuideFaqDto } from './dto/update-faq.dto';

const REVIEWER_ROLES = new Set(['VET', 'ADMIN', 'SUPERADMIN']);
const LOCKED_AUTHOR_STATUSES = new Set<string>([
  GuideStatus.PUBLISHED,
  GuideStatus.ARCHIVED,
]);

@Injectable()
export class GuideFaqsService {
  constructor(private readonly prisma: PrismaService) {}

  // Public: Active FAQs filtered by species (UUID or slug) and/or guideId.
  // Never exposes FAQs attached to unpublished or soft-deleted guides.
  async findAllPublic(species?: string, guideId?: string) {
    if (guideId && !UUID_REGEX.test(guideId)) {
      throw new BadRequestException('Invalid guideId UUID');
    }

    const andConditions: any[] = [
      { isActive: true },
      {
        OR: [
          { guideId: null },
          { guide: { status: GuideStatus.PUBLISHED, deletedAt: null } },
        ],
      },
    ];

    if (species && species !== 'all') {
      const cleanSpecies = species.trim();
      andConditions.push({
        species: UUID_REGEX.test(cleanSpecies)
          ? { id: cleanSpecies }
          : { slug: cleanSpecies },
      });
    }

    if (guideId) {
      andConditions.push({ guideId });
    }

    return this.prisma.guideFaq.findMany({
      where: { AND: andConditions },
      include: {
        species: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // Admin/Editorial: All FAQs including inactive
  async findAllAdmin(species?: string, guideId?: string) {
    if (guideId && !UUID_REGEX.test(guideId)) {
      throw new BadRequestException('Invalid guideId UUID');
    }

    const where: any = {};

    if (species) {
      const cleanSpecies = species.trim();
      where.species = UUID_REGEX.test(cleanSpecies)
        ? { id: cleanSpecies }
        : { slug: cleanSpecies };
    }

    if (guideId) {
      where.guideId = guideId;
    }

    return this.prisma.guideFaq.findMany({
      where,
      include: {
        species: { select: { id: true, name: true, slug: true } },
        guide: { select: { id: true, title: true, slug: true, status: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateGuideFaqDto, requester: AuthenticatedUser) {
    if (!dto.speciesId && !dto.guideId) {
      throw new BadRequestException(
        'An FAQ must be linked to at least a speciesId or a guideId',
      );
    }

    const isReviewerOrAdmin = REVIEWER_ROLES.has(requester.role);

    if (dto.speciesId) {
      if (!isReviewerOrAdmin) {
        throw new ForbiddenException(
          'Only Vets and Admins can create species-wide FAQs',
        );
      }
      const species = await this.prisma.petSpecies.findUnique({
        where: { id: dto.speciesId },
      });
      if (!species) {
        throw new BadRequestException('Selected speciesId does not exist');
      }
    }

    if (dto.guideId) {
      const guide = await this.prisma.guide.findFirst({
        where: { id: dto.guideId, deletedAt: null },
        select: { id: true, authorId: true, status: true },
      });
      if (!guide) {
        throw new BadRequestException('Selected guideId does not exist');
      }
      if (!isReviewerOrAdmin) {
        if (guide.authorId !== requester.userId) {
          throw new ForbiddenException(
            'Authors can only add FAQs to their own guides',
          );
        }
        if (LOCKED_AUTHOR_STATUSES.has(guide.status)) {
          throw new ForbiddenException(
            'Cannot add FAQs directly to a published or archived guide without editorial review',
          );
        }
      }
    }

    return this.prisma.guideFaq.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
        speciesId: dto.speciesId || null,
        guideId: dto.guideId || null,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateGuideFaqDto,
    requester: AuthenticatedUser,
  ) {
    const faq = await this.prisma.guideFaq.findUnique({
      where: { id },
      include: { guide: { select: { authorId: true, status: true } } },
    });

    if (!faq) {
      throw new NotFoundException(`FAQ with ID ${id} not found`);
    }

    const isReviewerOrAdmin = REVIEWER_ROLES.has(requester.role);
    if (!isReviewerOrAdmin) {
      if (faq.guide?.authorId !== requester.userId) {
        throw new ForbiddenException('You do not have permission to edit this FAQ');
      }
      if (faq.guide && LOCKED_AUTHOR_STATUSES.has(faq.guide.status)) {
        throw new ForbiddenException(
          'Cannot modify FAQs on a published or archived guide without editorial review',
        );
      }
    }

    const nextSpeciesId =
      dto.speciesId !== undefined ? dto.speciesId : faq.speciesId;
    const nextGuideId = dto.guideId !== undefined ? dto.guideId : faq.guideId;

    if (!nextSpeciesId && !nextGuideId) {
      throw new BadRequestException(
        'An FAQ must remain linked to at least a speciesId or a guideId',
      );
    }

    if (dto.speciesId) {
      if (!isReviewerOrAdmin) {
        throw new ForbiddenException(
          'Only Vets and Admins can assign species-wide FAQs',
        );
      }
      const species = await this.prisma.petSpecies.findUnique({
        where: { id: dto.speciesId },
      });
      if (!species) {
        throw new BadRequestException('Selected speciesId does not exist');
      }
    }

    if (dto.guideId) {
      const guide = await this.prisma.guide.findFirst({
        where: { id: dto.guideId, deletedAt: null },
        select: { id: true, authorId: true, status: true },
      });
      if (!guide) {
        throw new BadRequestException('Selected guideId does not exist');
      }
      if (!isReviewerOrAdmin) {
        if (guide.authorId !== requester.userId) {
          throw new ForbiddenException(
            'Authors can only attach FAQs to their own guides',
          );
        }
        if (LOCKED_AUTHOR_STATUSES.has(guide.status)) {
          throw new ForbiddenException(
            'Cannot attach FAQs to a published or archived guide without editorial review',
          );
        }
      }
    }

    return this.prisma.guideFaq.update({
      where: { id },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        speciesId: nextSpeciesId || null,
        guideId: nextGuideId || null,
      },
    });
  }

  async remove(id: string, requester: AuthenticatedUser) {
    const faq = await this.prisma.guideFaq.findUnique({
      where: { id },
      include: { guide: { select: { authorId: true, status: true } } },
    });

    if (!faq) {
      throw new NotFoundException(`FAQ with ID ${id} not found`);
    }

    const isReviewerOrAdmin = REVIEWER_ROLES.has(requester.role);
    if (!isReviewerOrAdmin) {
      if (faq.guide?.authorId !== requester.userId) {
        throw new ForbiddenException(
          'You do not have permission to delete this FAQ',
        );
      }
      if (faq.guide && LOCKED_AUTHOR_STATUSES.has(faq.guide.status)) {
        throw new ForbiddenException(
          'Cannot delete FAQs from a published or archived guide without editorial review',
        );
      }
    }

    await this.prisma.guideFaq.delete({ where: { id } });
    return { message: 'FAQ deleted successfully' };
  }
}
