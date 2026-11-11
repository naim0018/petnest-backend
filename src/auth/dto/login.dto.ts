import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ description: 'User email address or username', example: 'naim0018@gmail.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsNotEmpty({ message: 'Email or username is required' })
  @IsString({ message: 'Email or username must be a string' })
  @MaxLength(254, { message: 'Email or username cannot exceed 254 characters' })
  email: string;

  @ApiProperty({ example: 'Password@123' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
  password: string;
}
