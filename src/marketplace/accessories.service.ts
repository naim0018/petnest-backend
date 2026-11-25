import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAccessoryDto, UpdateAccessoryDto } from './dto/accessory.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { slugifyListing } from './marketplace.util';

@Injectable()
export class AccessoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccessoryDto, adminUserId?: string) {
    const slug = slugifyListing(dto.title);
    return this.prisma.petAccessoryListing.create({
      data: {
        ...dto,
        slug,
        createdById: adminUserId,
      },
      include: { targetSpecies: true },
    });
  }

  async findAll(query: ListingQueryDto) {
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
      this.prisma.petAccessoryListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { targetSpecies: true },
      }),
      this.prisma.petAccessoryListing.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.petAccessoryListing.findUnique({
      where: { id },
      include: { targetSpecies: true },
    });
    if (!item) throw new NotFoundException(`Pet accessory listing with ID ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdateAccessoryDto) {
    await this.findOne(id);
    return this.prisma.petAccessoryListing.update({
      where: { id },
      data: dto,
      include: { targetSpecies: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.petAccessoryListing.delete({ where: { id } });
  }
}
