import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from email link' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Reset token is required' })
  @IsString()
  @MaxLength(128, { message: 'Invalid reset token length' })
  token: string;

  @ApiProperty({ example: 'NewPassword@123', minLength: 6, maxLength: 72 })
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
        'Password must be at least 6 characters and contain uppercase, lowercase, number, and special character',
    },
  )
  newPassword: string;
}
