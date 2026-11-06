import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SAFE_URL_REGEX } from 'src/common/utils/validation.util';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '+14155552671' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number is too long' })
  @IsPhoneNumber(undefined, { message: 'Invalid phone number' })
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Avatar URL cannot exceed 500 characters' })
  @Matches(SAFE_URL_REGEX, {
    message:
      'Avatar must be a valid HTTP/HTTPS URL or safe relative path (e.g. /uploads/avatar.jpg)',
  })
  avatar?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Bangladesh' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: '1205' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;
}
