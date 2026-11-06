import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GuideStatus, GuideType } from 'prisma/generated/prisma/enums';
import { SAFE_URL_REGEX } from 'src/common/utils/validation.util';

export class CreateGuideDto {
  @ApiProperty({ example: 'Best Foods for Budgies & Small Parakeets' })
  @IsNotEmpty({ message: 'Title is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(180)
  title: string;

  @ApiPropertyOptional({ example: 'best-foods-for-budgies' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiProperty({
    example:
      'Learn what to feed your budgie or cockatiel for optimal metabolism, vibrant feathers, and a long life.',
  })
  @IsNotEmpty({ message: 'Excerpt is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  excerpt: string;

  @ApiPropertyOptional({
    example: [
      'Pellets should make up 60-70% of daily intake',
      'Never feed avocado, chocolate, onion, or apple seeds',
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(280, {
    each: true,
    message: 'Each key takeaway cannot exceed 280 characters',
  })
  keyTakeaways?: string[];

  @ApiProperty({
    description:
      'Rich Text HTML body (supports inline <img> and YouTube/Facebook <iframe>)',
  })
  @IsNotEmpty({ message: 'Content is required' })
  @IsString()
  @MinLength(50)
  @MaxLength(150000, {
    message: 'Guide HTML content cannot exceed 150,000 characters',
  })
  content: string;

  @ApiPropertyOptional({ enum: GuideType, default: GuideType.ARTICLE })
  @IsOptional()
  @IsEnum(GuideType)
  type?: GuideType;

  @ApiPropertyOptional({
    example: 'https://cdn.petnest.org/guides/2026/11/cover.webp',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'coverImage URL cannot exceed 500 characters' })
  @Matches(SAFE_URL_REGEX, {
    message:
      'coverImage must be a valid HTTP/HTTPS URL or safe relative path',
  })
  coverImage?: string | null;

  @ApiPropertyOptional({ example: 'Green budgie eating fresh leafy greens' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  coverImageAlt?: string;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional PetSpecies UUID (omit or null for universal All-Pets guides)',
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsUUID(undefined, { message: 'Invalid speciesId UUID' })
  speciesId?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional array of PetBreed UUIDs belonging to speciesId (empty = applies to all breeds of that species)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID(undefined, { each: true, message: 'Each breedId must be a valid UUID' })
  breedIds?: string[];

  @ApiProperty({ description: 'GuideCategory UUID' })
  @IsNotEmpty({ message: 'categoryId is required' })
  @IsUUID(undefined, { message: 'Invalid categoryId UUID' })
  categoryId: string;

  @ApiPropertyOptional({ example: ['diet', 'seeds', 'pellets'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Each tag cannot exceed 40 characters' })
  tags?: string[];

  @ApiPropertyOptional({ enum: GuideStatus, default: GuideStatus.DRAFT })
  @IsOptional()
  @IsEnum(GuideStatus)
  status?: GuideStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ maxLength: 70 })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;
}
