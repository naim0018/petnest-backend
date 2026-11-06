import { IsEmailField } from 'src/common/decorators/fields.decorator';

export class ForgotPasswordDto {
  @IsEmailField()
  email: string;
}
