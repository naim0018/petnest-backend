import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPaginatedResponse } from 'src/common/dto/pagination.dto';
import { UUID_REGEX } from 'src/common/utils/validation.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { BreedQueryDto } from './dto/breed-query.dto';
import { CreateBreedDto } from './dto/create-breed.dto';
import { CreateSpeciesDto } from './dto/create-species.dto';
import { SpeciesQueryDto } from './dto/species-query.dto';
import { UpdateBreedDto } from './dto/update-breed.dto';
import { UpdateSpeciesDto } from './dto/update-species.dto';

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new BadRequestException(
      'Invalid name or slug. It must contain alphanumeric characters.',
    );
  }
  return slug;
}

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== SPECIES ====================

  async createSpecies(dto: CreateSpeciesDto) {
    const slug = slugify(dto.slug || dto.name);
    const { slug: rawSlug, ...dataWithoutSlug } = dto;

    const existing = await this.prisma.petSpecies.findFirst({
      where: {
        OR: [
          { name: { equals: dto.name, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.name.toLowerCase() === dto.name.toLowerCase()
          ? `Species "${dto.name}" already exists`
          : `Species slug "${slug}" is already in use`,
      );
    }

    return this.prisma.petSpecies.create({
      data: {
        ...dataWithoutSlug,
        slug,
      },
    });
  }

  async findAllSpecies(query: SpeciesQueryDto) {
    const {
      page = 1,
      limit = 10,
      skip,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

    const where: any = {};

    if (search && search.trim() !== '') {
      const trimmed = search.trim();
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { slug: { contains: trimmed, mode: 'insensitive' } },
        { shortDescription: { contains: trimmed, mode: 'insensitive' } },
        { scientificGroup: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    const [speciesList, total] = await Promise.all([
      this.prisma.petSpecies.findMany({
        where,
        include: {
          breeds: {
            orderBy: { name: 'asc' },
          },
          _count: {
            // Protected: only exposes breed count to public, never registered users!
            select: { breeds: true },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.petSpecies.count({ where }),
    ]);

    return createPaginatedResponse(speciesList, total, page, limit, sortBy, sortOrder);
  }

  async findOneSpecies(idOrSlug: string) {
    const isId = UUID_REGEX.test(idOrSlug);

    const species = await this.prisma.petSpecies.findUnique({
      where: isId ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        breeds: { orderBy: { name: 'asc' } },
        _count: { select: { breeds: true } },
      },
    });

    if (!species) {
      throw new NotFoundException(`Species "${idOrSlug}" not found`);
    }

    return species;
  }

  async updateSpecies(idOrSlug: string, dto: UpdateSpeciesDto) {
    const species = await this.findOneSpecies(idOrSlug);
    const { slug: rawSlug, ...dataWithoutSlug } = dto;
    const newSlug = rawSlug ? slugify(rawSlug) : undefined;

    if (dto.name || newSlug) {
      const duplicate = await this.prisma.petSpecies.findFirst({
        where: {
          OR: [
            ...(dto.name ? [{ name: { equals: dto.name, mode: 'insensitive' as const } }] : []),
            ...(newSlug ? [{ slug: { equals: newSlug, mode: 'insensitive' as const } }] : []),
          ],
          NOT: { id: species.id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          duplicate.slug === newSlug
            ? `Species slug "${newSlug}" is already in use`
            : `Species "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.petSpecies.update({
      where: { id: species.id },
      data: {
        ...dataWithoutSlug,
        ...(newSlug ? { slug: newSlug } : {}),
      },
    });
  }

  async removeSpecies(idOrSlug: string) {
    const species = await this.findOneSpecies(idOrSlug);

    // Safeguard: Protect against accidental cascade deletion of all child breeds
    if (species._count.breeds > 0) {
      throw new BadRequestException(
        `Cannot delete species "${species.name}" because it still has ${species._count.breeds} active breed(s). Please delete or reassign its breeds first.`,
      );
    }

    await this.prisma.petSpecies.delete({ where: { id: species.id } });
    return { message: `Species "${species.name}" deleted successfully` };
  }

  // ==================== BREEDS ====================

  async createBreed(dto: CreateBreedDto) {
    // 1. Check parent species exists
    const species = await this.findOneSpecies(dto.speciesId);

    // 2. Generate slug and check duplicates
    const slug = slugify(dto.slug || dto.name);
    const { slug: rawSlug, ...dataWithoutSlug } = dto;

    const existing = await this.prisma.petBreed.findFirst({
      where: {
        OR: [
          {
            speciesId: species.id,
            name: { equals: dto.name, mode: 'insensitive' },
          },
          { slug: { equals: slug, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.slug === slug
          ? `Breed slug "${slug}" is already in use`
          : `Breed "${dto.name}" already exists under this species`,
      );
    }

    return this.prisma.petBreed.create({
      data: {
        ...dataWithoutSlug,
        speciesId: species.id,
        slug,
      },
      include: {
        species: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findAllBreeds(query: BreedQueryDto) {
    const {
      speciesId,
      search,
      page = 1,
      limit = 10,
      skip,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

    const where: any = {};

    if (speciesId) {
      where.speciesId = speciesId;
    }

    if (search && search.trim() !== '') {
      const trimmed = search.trim();
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { slug: { contains: trimmed, mode: 'insensitive' } },
        { originCountry: { contains: trimmed, mode: 'insensitive' } },
        { temperament: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    const [breeds, total] = await Promise.all([
      this.prisma.petBreed.findMany({
        where,
        include: {
          species: { select: { id: true, name: true, image: true, slug: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.petBreed.count({ where }),
    ]);

    return createPaginatedResponse(breeds, total, page, limit, sortBy, sortOrder);
  }

  async findOneBreed(idOrSlug: string) {
    const isId = UUID_REGEX.test(idOrSlug);

    const breed = await this.prisma.petBreed.findUnique({
      where: isId ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        species: { select: { id: true, name: true, image: true, slug: true } },
      },
    });

    if (!breed) {
      throw new NotFoundException(`Breed "${idOrSlug}" not found`);
    }

    return breed;
  }

  async updateBreed(idOrSlug: string, dto: UpdateBreedDto) {
    const currentBreed = await this.findOneBreed(idOrSlug);
    const { slug: rawSlug, ...dataWithoutSlug } = dto;
    const newSlug = rawSlug ? slugify(rawSlug) : undefined;
    const targetSpeciesId = dto.speciesId || currentBreed.speciesId;

    if (dto.speciesId && dto.speciesId !== currentBreed.speciesId) {
      await this.findOneSpecies(dto.speciesId);
    }

    const targetName = dto.name || currentBreed.name;

    if (dto.name || dto.speciesId || newSlug) {
      const duplicate = await this.prisma.petBreed.findFirst({
        where: {
          OR: [
            {
              speciesId: targetSpeciesId,
              name: { equals: targetName, mode: 'insensitive' },
            },
            ...(newSlug ? [{ slug: { equals: newSlug, mode: 'insensitive' as const } }] : []),
          ],
          NOT: { id: currentBreed.id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          duplicate.slug === newSlug
            ? `Breed slug "${newSlug}" is already in use`
            : `Breed "${targetName}" already exists under this species`,
        );
      }
    }

    // Atomic transaction: update breed AND sync any user interestedSpeciesId if species changed
    return this.prisma.$transaction(async (tx) => {
      const updatedBreed = await tx.petBreed.update({
        where: { id: currentBreed.id },
        data: {
          ...dataWithoutSlug,
          ...(newSlug ? { slug: newSlug } : {}),
        },
        include: {
          species: { select: { id: true, name: true, slug: true } },
        },
      });

      // Keep user preferences synchronized if breed changed species
      if (dto.speciesId && dto.speciesId !== currentBreed.speciesId) {
        await tx.user.updateMany({
          where: { interestedBreedId: currentBreed.id },
          data: { interestedSpeciesId: targetSpeciesId },
        });
      }

      return updatedBreed;
    });
  }

  async removeBreed(idOrSlug: string) {
    const breed = await this.findOneBreed(idOrSlug);
    await this.prisma.petBreed.delete({ where: { id: breed.id } });
    return { message: `Breed "${breed.name}" deleted successfully` };
  }
}
