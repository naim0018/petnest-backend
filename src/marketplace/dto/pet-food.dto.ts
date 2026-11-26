import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import {
  FoodLifeStage,
  FoodType,
  ListingStatus,
  WeightUnit,
} from 'prisma/generated/prisma/client';

export class CreatePetFoodDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  buyingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number = 1;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNotEmpty()
  @IsString()
  brand: string;

  @IsNotEmpty()
  @IsEnum(FoodType)
  foodType: FoodType;

  @IsOptional()
  @IsEnum(FoodLifeStage)
  lifeStage?: FoodLifeStage = FoodLifeStage.ALL_STAGES;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  netWeight: number;

  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit = WeightUnit.KG;

  @IsNotEmpty()
  @IsString()
  targetSpeciesId: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  guaranteedAnalysis?: any;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  isOrganic?: boolean = false;

  @IsOptional()
  @IsString()
  thumbnailImage?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videoUrls?: string[] = [];

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus = ListingStatus.DRAFT;

  @IsOptional()
  @IsString()
  storeName?: string = 'PetNest Official Direct';
}

export class UpdatePetFoodDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  buyingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stockQuantity?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsEnum(FoodType)
  foodType?: FoodType;

  @IsOptional()
  @IsEnum(FoodLifeStage)
  lifeStage?: FoodLifeStage;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  netWeight?: number;

  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @IsOptional()
  @IsString()
  targetSpeciesId?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  guaranteedAnalysis?: any;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  isOrganic?: boolean;

  @IsOptional()
  @IsString()
  thumbnailImage?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videoUrls?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsString()
  storeName?: string;
}
