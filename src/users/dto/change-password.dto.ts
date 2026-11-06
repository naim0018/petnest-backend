import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ maxLength: 72 })
  @IsNotEmpty({ message: 'Current password is required' })
  @IsString()
  @MaxLength(72, { message: 'Current password cannot exceed 72 characters' })
  currentPassword: string;

  @ApiProperty({ minLength: 6, maxLength: 72 })
  @IsNotEmpty({ message: 'New password is required' })
  @IsString()
  @MaxLength(72, { message: 'New password cannot exceed 72 characters' })
  @IsStrongPassword(
    {
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'New password must be at least 6 characters and include uppercase, lowercase, number, and symbol',
    },
  )
  newPassword: string;
}
