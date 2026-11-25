import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus } from 'prisma/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [livePetsCount, foodCount, accessoriesCount, booksCount, medicineCount] =
      await Promise.all([
        this.prisma.livePetListing.count(),
        this.prisma.petFoodListing.count(),
        this.prisma.petAccessoryListing.count(),
        this.prisma.petBookListing.count(),
        this.prisma.petMedicineListing.count(),
      ]);

    const [recentPets, recentFood, recentAccessories] = await Promise.all([
      this.prisma.livePetListing.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, price: true, status: true, coverImage: true, createdAt: true },
      }),
      this.prisma.petFoodListing.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, price: true, status: true, coverImage: true, createdAt: true },
      }),
      this.prisma.petAccessoryListing.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, price: true, status: true, coverImage: true, createdAt: true },
      }),
    ]);

    return {
      counts: {
        total: livePetsCount + foodCount + accessoriesCount + booksCount + medicineCount,
        livePets: livePetsCount,
        food: foodCount,
        accessories: accessoriesCount,
        books: booksCount,
        medicine: medicineCount,
      },
      recent: [
        ...recentPets.map((p) => ({ ...p, domain: 'LIVE_PET' })),
        ...recentFood.map((f) => ({ ...f, domain: 'PET_FOOD' })),
        ...recentAccessories.map((a) => ({ ...a, domain: 'GEAR_ACCESSORIES' })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }

  async updateStatus(type: string, id: string, status: ListingStatus) {
    switch (type.toLowerCase()) {
      case 'pets':
      case 'live-pets':
        return this.prisma.livePetListing.update({ where: { id }, data: { status } });
      case 'food':
      case 'pet-food':
        return this.prisma.petFoodListing.update({ where: { id }, data: { status } });
      case 'accessories':
        return this.prisma.petAccessoryListing.update({ where: { id }, data: { status } });
      case 'books':
        return this.prisma.petBookListing.update({ where: { id }, data: { status } });
      case 'medicine':
        return this.prisma.petMedicineListing.update({ where: { id }, data: { status } });
      default:
        throw new BadRequestException(`Unknown marketplace domain: ${type}`);
    }
  }
}
