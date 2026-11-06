import { PartialType } from '@nestjs/swagger';
import { CreateGuideFaqDto } from './create-faq.dto';

export class UpdateGuideFaqDto extends PartialType(CreateGuideFaqDto) {}
