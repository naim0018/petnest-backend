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
import { BookFormat, ListingStatus } from 'prisma/generated/prisma/client';

export class CreateBookDto {
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

  @IsNotEmpty()
  @IsString()
  author: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  language?: string = 'English';

  @IsOptional()
  @IsEnum(BookFormat)
  format?: BookFormat = BookFormat.PAPERBACK;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalPages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  publicationYear?: number;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  samplePdfUrl?: string;

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

export class UpdateBookDto {
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
  author?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsEnum(BookFormat)
  format?: BookFormat;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalPages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  publicationYear?: number;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  samplePdfUrl?: string;

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
