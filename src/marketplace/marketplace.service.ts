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
        select: { id: true, title: true, price: true, salePrice: true, buyingPrice: true, status: true, coverImage: true, createdAt: true },
      }),
      this.prisma.petFoodListing.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, price: true, salePrice: true, buyingPrice: true, status: true, coverImage: true, createdAt: true },
      }),
      this.prisma.petAccessoryListing.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, price: true, salePrice: true, buyingPrice: true, status: true, coverImage: true, createdAt: true },
      }),
    ]);

    // Financial & Inventory Valuation across all active inventory
    const [allPets, allFood, allAccessories, allBooks, allMedicine] = await Promise.all([
      this.prisma.livePetListing.findMany({
        where: { status: ListingStatus.ACTIVE },
        select: { price: true, salePrice: true, buyingPrice: true, quantity: true },
      }),
      this.prisma.petFoodListing.findMany({
        where: { status: ListingStatus.ACTIVE },
        select: { price: true, salePrice: true, buyingPrice: true, stockQuantity: true },
      }),
      this.prisma.petAccessoryListing.findMany({
        where: { status: ListingStatus.ACTIVE },
        select: { price: true, salePrice: true, buyingPrice: true, stockQuantity: true },
      }),
      this.prisma.petBookListing.findMany({
        where: { status: ListingStatus.ACTIVE },
        select: { price: true, salePrice: true, buyingPrice: true, stockQuantity: true },
      }),
      this.prisma.petMedicineListing.findMany({
        where: { status: ListingStatus.ACTIVE },
        select: { price: true, salePrice: true, buyingPrice: true, stockQuantity: true },
      }),
    ]);

    let totalCostValuation = 0;
    let totalRetailValuation = 0;

    const accumulate = (items: any[], qtyKey: string) => {
      for (const item of items) {
        const qty = item[qtyKey] || 1;
        const retail = Number(item.salePrice ?? item.price ?? 0);
        const cost = Number(item.buyingPrice ?? 0);
        totalRetailValuation += retail * qty;
        totalCostValuation += cost * qty;
      }
    };

    accumulate(allPets, 'quantity');
    accumulate(allFood, 'stockQuantity');
    accumulate(allAccessories, 'stockQuantity');
    accumulate(allBooks, 'stockQuantity');
    accumulate(allMedicine, 'stockQuantity');

    const estimatedGrossProfit = totalRetailValuation - totalCostValuation;
    const avgMarginPercent =
      totalRetailValuation > 0
        ? Math.round((estimatedGrossProfit / totalRetailValuation) * 100 * 10) / 10
        : 0;

    return {
      counts: {
        total: livePetsCount + foodCount + accessoriesCount + booksCount + medicineCount,
        livePets: livePetsCount,
        food: foodCount,
        accessories: accessoriesCount,
        books: booksCount,
        medicine: medicineCount,
      },
      valuation: {
        totalCostValuation: Math.round(totalCostValuation * 100) / 100,
        totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
        estimatedGrossProfit: Math.round(estimatedGrossProfit * 100) / 100,
        avgMarginPercent,
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
