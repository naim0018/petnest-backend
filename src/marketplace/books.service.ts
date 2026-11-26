import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBookDto, UpdateBookDto } from './dto/book.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { isStaffRole, normalizeMediaPayload, sanitizeListingForViewer, slugifyListing } from './marketplace.util';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookDto, adminUserId?: string) {
    const slug = slugifyListing(dto.title);
    return this.prisma.petBookListing.create({
      data: {
        ...normalizeMediaPayload(dto),
        slug,
        createdById: adminUserId ?? null,
      } as any,
    });
  }

  async findAll(query: ListingQueryDto, role?: string) {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { publisher: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.petBookListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.petBookListing.count({ where }),
    ]);

    const isStaff = isStaffRole(role);

    return {
      items: items.map((i) => sanitizeListingForViewer(i, isStaff)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, role?: string) {
    const item = await this.prisma.petBookListing.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`Pet book listing with ID ${id} not found`);
    return sanitizeListingForViewer(item, isStaffRole(role));
  }

  async update(id: string, dto: UpdateBookDto) {
    await this.findOne(id);
    return this.prisma.petBookListing.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.petBookListing.delete({ where: { id } });
  }
}
