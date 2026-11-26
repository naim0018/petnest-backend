import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePetFoodDto, UpdatePetFoodDto } from './dto/pet-food.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { isStaffRole, normalizeMediaPayload, sanitizeListingForViewer, slugifyListing } from './marketplace.util';

@Injectable()
export class PetFoodService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePetFoodDto, adminUserId?: string) {
    const slug = slugifyListing(dto.title);
    return this.prisma.petFoodListing.create({
      data: {
        ...normalizeMediaPayload(dto),
        slug,
        createdById: adminUserId ?? null,
      } as any,
      include: { targetSpecies: true },
    });
  }

  async findAll(query: ListingQueryDto, role?: string) {
    const { page = 1, limit = 20, status, search, speciesId, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (speciesId) where.targetSpeciesId = speciesId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.petFoodListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { targetSpecies: true },
      }),
      this.prisma.petFoodListing.count({ where }),
    ]);

    const isStaff = isStaffRole(role);

    return {
      items: items.map((i) => sanitizeListingForViewer(i, isStaff)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, role?: string) {
    const item = await this.prisma.petFoodListing.findUnique({
      where: { id },
      include: { targetSpecies: true },
    });
    if (!item) throw new NotFoundException(`Pet food listing with ID ${id} not found`);
    return sanitizeListingForViewer(item, isStaffRole(role));
  }

  async update(id: string, dto: UpdatePetFoodDto) {
    await this.findOne(id);
    return this.prisma.petFoodListing.update({
      where: { id },
      data: dto,
      include: { targetSpecies: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.petFoodListing.delete({ where: { id } });
  }
}
