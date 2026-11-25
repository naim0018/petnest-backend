import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLivePetDto, UpdateLivePetDto } from './dto/live-pet.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { slugifyListing } from './marketplace.util';

@Injectable()
export class LivePetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLivePetDto, adminUserId?: string) {
    const slug = slugifyListing(dto.title);
    return this.prisma.livePetListing.create({
      data: {
        ...dto,
        slug,
        createdById: adminUserId,
      },
      include: {
        species: true,
        breed: true,
      },
    });
  }

  async findAll(query: ListingQueryDto) {
    const { page = 1, limit = 20, status, search, speciesId, breedId, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (speciesId) where.speciesId = speciesId;
    if (breedId) where.breedId = breedId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { colorMutation: { contains: search, mode: 'insensitive' } },
        { ringNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.livePetListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { species: true, breed: true },
      }),
      this.prisma.livePetListing.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.livePetListing.findUnique({
      where: { id },
      include: { species: true, breed: true },
    });
    if (!item) throw new NotFoundException(`Live pet listing with ID ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdateLivePetDto) {
    await this.findOne(id);
    return this.prisma.livePetListing.update({
      where: { id },
      data: dto,
      include: { species: true, breed: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.livePetListing.delete({ where: { id } });
  }
}
