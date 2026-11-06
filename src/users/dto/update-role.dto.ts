import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from 'prisma/generated/prisma/enums';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.AUTHOR,
    description:
      'Assign editorial or administrative role (USER, AUTHOR, VET, ADMIN, SUPERADMIN)',
  })
  @IsNotEmpty()
  @IsEnum(Role)
  role: Role;
}
