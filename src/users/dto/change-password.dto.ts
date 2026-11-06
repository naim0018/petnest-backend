import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Current password is required' })
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'New password is required' })
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
