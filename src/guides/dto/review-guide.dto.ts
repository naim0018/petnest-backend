import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReviewDecision {
  PUBLISH = 'PUBLISH',
  NEEDS_REVISION = 'NEEDS_REVISION',
  ARCHIVE = 'ARCHIVE',
}

export class ReviewGuideDto {
  @ApiProperty({ enum: ReviewDecision })
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @ApiPropertyOptional({
    description: 'Editorial or veterinary revision notes (required if NEEDS_REVISION)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;

  @ApiPropertyOptional({
    description: 'Set current reviewer as verified medical/expert reviewer',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  markExpertReviewed?: boolean;
}
