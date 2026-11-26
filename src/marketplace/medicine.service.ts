import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/medicine.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { isStaffRole, normalizeMediaPayload, sanitizeListingForViewer, slugifyListing } from './marketplace.util';

@Injectable()
export class MedicineService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMedicineDto, adminUserId?: string) {
    const slug = slugifyListing(dto.title);
    return this.prisma.petMedicineListing.create({
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
        { genericName: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.petMedicineListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.petMedicineListing.count({ where }),
    ]);

    const isStaff = isStaffRole(role);

    return {
      items: items.map((i) => sanitizeListingForViewer(i, isStaff)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, role?: string) {
    const item = await this.prisma.petMedicineListing.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`Pet medicine listing with ID ${id} not found`);
    return sanitizeListingForViewer(item, isStaffRole(role));
  }

  async update(id: string, dto: UpdateMedicineDto) {
    await this.findOne(id);
    return this.prisma.petMedicineListing.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.petMedicineListing.delete({ where: { id } });
  }
}
