import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CareLevel, PetSize } from 'prisma/generated/prisma/enums';
import { SAFE_URL_REGEX } from 'src/common/utils/validation.util';

export class CreateBreedDto {
  @ApiProperty({ example: 'Golden Retriever', description: 'Name of the pet breed' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Breed name is required' })
  @IsString({ message: 'Breed name must be a string' })
  @MinLength(2, { message: 'Breed name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Breed name must be at most 100 characters long' })
  name: string;

  @ApiProperty({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'UUID of the parent PetSpecies',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'speciesId is required' })
  @IsUUID('4', { message: 'speciesId must be a valid UUID' })
  speciesId: string;

  @ApiPropertyOptional({
    example: 'golden-retriever',
    description: 'URL-friendly unique slug (auto-generated from name if omitted)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Slug cannot exceed 120 characters' })
  slug?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/golden-retriever.png',
    description: 'Image URL or safe relative path for the breed',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Image path cannot exceed 500 characters' })
  @Matches(SAFE_URL_REGEX, {
    message: 'Image must be a valid HTTP/HTTPS URL or safe relative path (e.g. /uploads/breed.png)',
  })
  image?: string;

  @ApiPropertyOptional({
    example: 'Friendly, intelligent, and devoted family dogs.',
    description: 'Short overview description of the breed',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Short description cannot exceed 300 characters' })
  shortDescription?: string;

  @ApiPropertyOptional({
    example: ['Friendly', 'Active', 'Family-friendly'],
    description: 'Array of up to 20 tag keywords (each max 30 characters)',
  })
  @IsOptional()
  @IsArray({ message: 'tags must be an array of strings' })
  @ArrayMaxSize(20, { message: 'You cannot provide more than 20 tags' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  @MaxLength(30, { each: true, message: 'Each tag cannot exceed 30 characters' })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'Scotland, UK',
    description: 'Country or region where the breed originated',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Origin country cannot exceed 100 characters' })
  originCountry?: string;

  @ApiPropertyOptional({
    enum: PetSize,
    default: PetSize.MEDIUM,
    description: 'Physical size category of the breed: SMALL, MEDIUM, LARGE, GIANT',
  })
  @IsOptional()
  @IsEnum(PetSize, { message: 'size must be one of: SMALL, MEDIUM, LARGE, GIANT' })
  size?: PetSize;

  @ApiPropertyOptional({
    enum: CareLevel,
    default: CareLevel.MODERATE,
    description: 'Maintenance/care level required: LOW, MODERATE, HIGH',
  })
  @IsOptional()
  @IsEnum(CareLevel, { message: 'careLevel must be one of: LOW, MODERATE, HIGH' })
  careLevel?: CareLevel;

  @ApiPropertyOptional({
    example: 'Friendly, Intelligent, Devoted',
    description: 'Behavior and temperament characteristics',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Temperament cannot exceed 200 characters' })
  temperament?: string;
}
