import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number (minimum 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Items per page (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'limit cannot exceed 100 items per page' })
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Search query keyword' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Sort direction (asc or desc)',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], {
    message: "sortOrder must be either 'asc' or 'desc'",
  })
  sortOrder?: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      sortBy,
      sortOrder,
    },
  };
}
