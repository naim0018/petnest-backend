import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsEmailField } from 'src/common/decorators/fields.decorator';

export class LoginDto {
  @IsEmailField()
  email: string;

  @ApiProperty({ example: 'Password@123' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
  password: string;
}
