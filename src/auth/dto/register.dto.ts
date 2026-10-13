import {
  IsEmailField,
  IsNameField,
  IsOptionalUuidField,
  IsPasswordField,
  IsPhoneField,
} from 'src/common/decorators/fields.decorator';

export class RegisterDto {
  @IsNameField()
  name: string;

  @IsEmailField()
  email: string;

  @IsPasswordField()
  password: string;

  @IsPhoneField()
  phone: string;

  @IsOptionalUuidField('Preferred pet species UUID', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
  interestedSpecies?: string;

  @IsOptionalUuidField('Preferred pet breed UUID', 'b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22')
  interestedBreed?: string;
}