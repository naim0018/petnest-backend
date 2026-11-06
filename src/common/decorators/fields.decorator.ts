import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Validates, trims, and documents a full name property
 */
export function IsNameField() {
  return applyDecorators(
    ApiProperty({
      description: 'Full name of the user',
      example: 'John Doe',
      minLength: 2,
      maxLength: 50,
    }),
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    IsNotEmpty({ message: 'Name is required' }),
    IsString({ message: 'Name must be a string' }),
    MinLength(2, { message: 'Name too short' }),
    MaxLength(50, { message: 'Name too long' }),
  );
}

/**
 * Validates, trims, lowercases, and documents an email address
 */
export function IsEmailField() {
  return applyDecorators(
    ApiProperty({
      description: 'User email address',
      example: 'john.doe@example.com',
      maxLength: 254,
    }),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsNotEmpty({ message: 'Email is required' }),
    IsString({ message: 'Email must be a string' }),
    MaxLength(254, { message: 'Email cannot exceed 254 characters' }),
    IsEmail({}, { message: 'Invalid email address' }),
  );
}

/**
 * Validates and documents a strong password with security criteria (bounded to 72 chars for bcrypt)
 */
export function IsPasswordField() {
  return applyDecorators(
    ApiProperty({
      description:
        'Password (6-72 characters, including uppercase, lowercase, number, and special character)',
      example: 'Password@123',
      minLength: 6,
      maxLength: 72,
    }),
    IsNotEmpty({ message: 'Password is required' }),
    IsString({ message: 'Password must be a string' }),
    MaxLength(72, { message: 'Password cannot exceed 72 characters' }),
    IsStrongPassword(
      {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      },
      {
        message:
          'Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      },
    ),
  );
}

/**
 * Validates and documents an international phone number
 */
export function IsPhoneField() {
  return applyDecorators(
    ApiProperty({
      description: 'Phone number in international format',
      example: '+14155552671',
    }),
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    IsNotEmpty({ message: 'Phone is required' }),
    IsString({ message: 'Phone must be a string' }),
    MaxLength(20, { message: 'Phone number is too long' }),
    IsPhoneNumber(undefined, { message: 'Invalid phone number' }),
  );
}

/**
 * Validates and documents an optional UUID field
 */
export function IsOptionalUuidField(description?: string, example?: string) {
  return applyDecorators(
    ApiPropertyOptional({
      description: description ?? 'UUID v4 identifier',
      example: example ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      format: 'uuid',
    }),
    IsOptional(),
    IsUUID('4', { message: 'Invalid UUID' }),
  );
}
