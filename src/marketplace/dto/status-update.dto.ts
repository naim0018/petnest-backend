import { IsEnum, IsNotEmpty } from 'class-validator';
import { ListingStatus } from 'prisma/generated/prisma/client';

export class UpdateStatusDto {
  @IsNotEmpty()
  @IsEnum(ListingStatus)
  status: ListingStatus;
}
