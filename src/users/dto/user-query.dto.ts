import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export const USER_SORT_COLUMNS = [
  'name',
  'email',
  'phone',
  'role',
  'createdAt',
  'updatedAt',
  'city',
  'country',
] as const;

export type UserSortColumn = (typeof USER_SORT_COLUMNS)[number];

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['USER', 'SUPERADMIN'],
    description: 'Filter by user role',
  })
  @IsOptional()
  @IsEnum(['USER', 'SUPERADMIN'])
  role?: 'USER' | 'SUPERADMIN';

  @ApiPropertyOptional({
    enum: USER_SORT_COLUMNS,
    default: 'createdAt',
    description:
      'Column to sort by: name, email, phone, role, createdAt, updatedAt, city, country',
  })
  @IsOptional()
  @IsEnum(USER_SORT_COLUMNS, {
    message: `sortBy must be one of: ${USER_SORT_COLUMNS.join(', ')}`,
  })
  sortBy?: UserSortColumn = 'createdAt';
}
