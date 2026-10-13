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
 * Validates and documents a full name property
 */
export function IsNameField() {
  return applyDecorators(
    ApiProperty({
      description: 'Full name of the user',
      example: 'John Doe',
      minLength: 2,
      maxLength: 50,
    }),
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
    }),
    IsNotEmpty({ message: 'Email is required' }),
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsEmail({}, { message: 'Invalid email address' }),
  );
}

/**
 * Validates and documents a strong password with security criteria
 */
export function IsPasswordField() {
  return applyDecorators(
    ApiProperty({
      description: 'Password (min 6 characters, including uppercase, lowercase, number, and special character)',
      example: 'Password@123',
      minLength: 6,
      maxLength: 20,
    }),
    IsNotEmpty({ message: 'Password is required' }),
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
      description: 'Phone number in international or regional format',
      example: '+14155552671',
    }),
    IsNotEmpty({ message: 'Phone is required' }),
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
