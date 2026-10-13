import { IsEmail, IsString, IsStrongPassword } from 'class-validator';
import { IsEmailField, IsNameField, IsPasswordField } from 'src/common/decorators/fields.decorator';

export class LoginDto {
  @IsEmailField()
  email: string;
  @IsPasswordField()
  password: string;
}
