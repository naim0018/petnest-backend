import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export const BREED_SORT_COLUMNS = [
  'name',
  'slug',
  'originCountry',
  'size',
  'careLevel',
  'createdAt',
] as const;

export type BreedSortColumn = (typeof BREED_SORT_COLUMNS)[number];

export class BreedQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter breeds by parent species UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'speciesId must be a valid UUID' })
  speciesId?: string;

  @ApiPropertyOptional({
    enum: BREED_SORT_COLUMNS,
    default: 'name',
    description:
      'Column to sort by: name, slug, originCountry, size, careLevel, createdAt',
  })
  @IsOptional()
  @IsEnum(BREED_SORT_COLUMNS, {
    message: `sortBy must be one of: ${BREED_SORT_COLUMNS.join(', ')}`,
  })
  sortBy?: BreedSortColumn = 'name';
}
