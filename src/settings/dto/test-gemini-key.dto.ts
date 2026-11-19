import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TestGeminiKeyDto {
  @ApiPropertyOptional({
    description: 'Optional API key to test before persisting to database',
    example: 'AIzaSyD-xxx...',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;
}
