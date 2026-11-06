import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export const SPECIES_SORT_COLUMNS = ['name', 'slug', 'createdAt'] as const;
export type SpeciesSortColumn = (typeof SPECIES_SORT_COLUMNS)[number];

export class SpeciesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: SPECIES_SORT_COLUMNS,
    default: 'name',
    description: 'Column to sort by: name, slug, createdAt',
  })
  @IsOptional()
  @IsEnum(SPECIES_SORT_COLUMNS, {
    message: `sortBy must be one of: ${SPECIES_SORT_COLUMNS.join(', ')}`,
  })
  sortBy?: SpeciesSortColumn = 'name';
}
