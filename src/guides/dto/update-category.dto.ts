import { PartialType } from '@nestjs/swagger';
import { CreateGuideCategoryDto } from './create-category.dto';

export class UpdateGuideCategoryDto extends PartialType(CreateGuideCategoryDto) {}
