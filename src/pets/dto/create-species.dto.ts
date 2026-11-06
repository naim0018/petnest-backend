import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { SAFE_URL_REGEX } from 'src/common/utils/validation.util';

export class CreateSpeciesDto {
  @ApiProperty({ example: 'Dogs', description: 'Name of the pet species' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Species name is required' })
  @IsString({ message: 'Species name must be a string' })
  @MinLength(2, { message: 'Species name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Species name must be at most 50 characters long' })
  name: string;

  @ApiPropertyOptional({
    example: 'dogs',
    description: 'URL-friendly unique slug (auto-generated from name if omitted)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Slug cannot exceed 60 characters' })
  slug?: string;

  @ApiPropertyOptional({
    example: 'Canis lupus familiaris',
    description: 'Scientific taxonomy group',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Scientific group cannot exceed 100 characters' })
  scientificGroup?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/dog-card.png',
    description: 'Main mascot/card image URL or safe relative path',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Image path cannot exceed 500 characters' })
  @Matches(SAFE_URL_REGEX, {
    message: 'Image must be a valid HTTP/HTTPS URL or safe relative path (e.g. /uploads/dog.png)',
  })
  image?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/dog-icon.svg',
    description: 'Round category avatar icon URL or safe relative path',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Category icon path cannot exceed 500 characters' })
  @Matches(SAFE_URL_REGEX, {
    message:
      'Category icon must be a valid HTTP/HTTPS URL or safe relative path (e.g. /uploads/icon.svg)',
  })
  categoryIcon?: string;

  @ApiPropertyOptional({
    example: 'Canine companion animals known for loyalty and friendliness.',
    description: 'Short overview description of the species',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Short description cannot exceed 300 characters' })
  shortDescription?: string;
}
