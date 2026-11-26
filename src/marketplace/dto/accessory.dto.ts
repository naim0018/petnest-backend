import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
  AccessoryCategory,
  ListingStatus,
} from 'prisma/generated/prisma/client';

export class CreateAccessoryDto {
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
  @IsEnum(AccessoryCategory)
  category: AccessoryCategory;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  targetSpeciesId?: string;

  @IsOptional()
  @IsString()
  dimensions?: string;

  @IsOptional()
  @IsString()
  barSpacing?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  sizeOption?: string;

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

export class UpdateAccessoryDto {
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
  @IsEnum(AccessoryCategory)
  category?: AccessoryCategory;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  targetSpeciesId?: string;

  @IsOptional()
  @IsString()
  dimensions?: string;

  @IsOptional()
  @IsString()
  barSpacing?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  sizeOption?: string;

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
