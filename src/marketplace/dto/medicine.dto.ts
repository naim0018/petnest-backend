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
  ListingStatus,
  MedicineDosageForm,
} from 'prisma/generated/prisma/client';

export class CreateMedicineDto {
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
  genericName: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsNotEmpty()
  @IsEnum(MedicineDosageForm)
  dosageForm: MedicineDosageForm;

  @IsNotEmpty()
  @IsString()
  packSize: string;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean = false;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSpeciesList?: string[] = [];

  @IsNotEmpty()
  @IsString()
  dosageInstructions: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

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

export class UpdateMedicineDto {
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
  genericName?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsEnum(MedicineDosageForm)
  dosageForm?: MedicineDosageForm;

  @IsOptional()
  @IsString()
  packSize?: string;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSpeciesList?: string[];

  @IsOptional()
  @IsString()
  dosageInstructions?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

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
