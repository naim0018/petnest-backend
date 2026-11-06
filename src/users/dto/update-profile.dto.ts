import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'UUID of preferred species' })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid UUID for interestedSpeciesId' })
  interestedSpeciesId?: string;

  @ApiPropertyOptional({ description: 'UUID of preferred breed' })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid UUID for interestedBreedId' })
  interestedBreedId?: string;

  // Profile Specific Fields
  @ApiPropertyOptional({ example: 'Pet lover with 2 dogs.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Bangladesh' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '1205' })
  @IsOptional()
  @IsString()
  zipCode?: string;
}
