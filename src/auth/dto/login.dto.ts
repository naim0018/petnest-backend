import { IsEmail, IsString, IsStrongPassword } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsEmail()
  email: string;
  @IsString()
  @IsStrongPassword()
  password: string;
}

export class SignupDto {
  @IsString()
  @IsEmail()
  email: string;
  @IsString()
  name: string;
  @IsString()
  @IsStrongPassword()
  password: string;
}
