import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGuideFaqDto {
  @ApiProperty({ example: 'How often should I let my budgie out of its cage?' })
  @IsNotEmpty({ message: 'Question is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(250)
  question: string;

  @ApiProperty({
    example:
      'Aim for at least 1–2 hours of supervised out-of-cage flight and exercise daily in a bird-safe room.',
  })
  @IsNotEmpty({ message: 'Answer is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  answer: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Attach FAQ to a PetSpecies explorer page',
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsUUID(undefined, { message: 'Invalid speciesId UUID' })
  speciesId?: string | null;

  @ApiPropertyOptional({
    description: 'Attach FAQ to a specific Guide article',
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsUUID(undefined, { message: 'Invalid guideId UUID' })
  guideId?: string | null;
}
