import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GenerateGuideAiDto {
  @ApiProperty({
    example: 'Common Health Issues in Budgies',
    description: 'Topic or title prompt for the guide',
  })
  @IsNotEmpty({ message: 'Topic is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Topic must be at least 3 characters long' })
  @MaxLength(200, { message: 'Topic cannot exceed 200 characters' })
  topic: string;

  @ApiPropertyOptional({
    description: 'Optional category UUID to contextualize the guide',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Optional species UUID for pet-specific context',
  })
  @IsOptional()
  @IsString()
  speciesId?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Whether to immediately save the generated guide and FAQs to the database as DRAFT',
  })
  @IsOptional()
  @IsBoolean()
  saveToDb?: boolean;
}
