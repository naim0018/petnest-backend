import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccessoriesController } from './accessories.controller';
import { AccessoriesService } from './accessories.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { LivePetsController } from './live-pets.controller';
import { LivePetsService } from './live-pets.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MedicineController } from './medicine.controller';
import { MedicineService } from './medicine.service';
import { PetFoodController } from './pet-food.controller';
import { PetFoodService } from './pet-food.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    LivePetsController,
    PetFoodController,
    AccessoriesController,
    BooksController,
    MedicineController,
    MarketplaceController,
  ],
  providers: [
    LivePetsService,
    PetFoodService,
    AccessoriesService,
    BooksService,
    MedicineService,
    MarketplaceService,
  ],
  exports: [
    LivePetsService,
    PetFoodService,
    AccessoriesService,
    BooksService,
    MedicineService,
    MarketplaceService,
  ],
})
export class MarketplaceModule {}
