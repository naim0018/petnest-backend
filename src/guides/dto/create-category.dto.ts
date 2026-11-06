import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGuideCategoryDto {
  @ApiProperty({ example: 'Nutrition' })
  @IsNotEmpty({ message: 'Category name is required' })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ example: 'nutrition' })
  @IsOptional()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({
    example: 'Vet-approved feeding schedules, safe foods, and balanced diets.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ example: 'UtensilsCrossed' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
