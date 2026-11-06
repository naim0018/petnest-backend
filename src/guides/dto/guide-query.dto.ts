import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GuideStatus, GuideType } from 'prisma/generated/prisma/enums';

export const GUIDE_SORT_COLUMNS = [
  'publishedAt',
  'createdAt',
  'updatedAt',
  'viewCount',
  'likeCount',
  'bookmarkCount',
  'readTimeMinutes',
  'title',
] as const;

export type GuideSortColumn = (typeof GUIDE_SORT_COLUMNS)[number];

export class GuideQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 12, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 12;

  @ApiPropertyOptional({ description: 'Search by title, excerpt, or tags' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Species UUID or slug (e.g. "birds")' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  species?: string;

  @ApiPropertyOptional({ description: 'Breed UUID or slug (e.g. "budgie")' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  breed?: string;

  @ApiPropertyOptional({ description: 'Category UUID or slug (e.g. "nutrition")' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ enum: GuideType })
  @IsOptional()
  @IsEnum(GuideType)
  type?: GuideType;

  @ApiPropertyOptional({ enum: GuideStatus, description: 'Editorial status filter' })
  @IsOptional()
  @IsEnum(GuideStatus)
  status?: GuideStatus;

  @ApiPropertyOptional({ description: 'Filter featured guides only' })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by author UUID' })
  @IsOptional()
  @IsUUID(undefined, { message: 'authorId must be a valid UUID' })
  authorId?: string;

  @ApiPropertyOptional({ enum: GUIDE_SORT_COLUMNS, default: 'publishedAt' })
  @IsOptional()
  @IsEnum(GUIDE_SORT_COLUMNS)
  sortBy?: GuideSortColumn = 'publishedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
