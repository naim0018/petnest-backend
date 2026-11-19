import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateGeminiKeyDto {
  @ApiProperty({
    description: 'Google Gemini API key',
    example: 'AIzaSyD-xxx...',
  })
  @IsString()
  @IsNotEmpty({ message: 'API key cannot be empty' })
  @MinLength(10, { message: 'API key must be at least 10 characters long' })
  apiKey: string;
}
