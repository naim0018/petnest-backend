import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class BanUserDto {
  @ApiProperty({
    description: 'Whether the user account should be banned or unbanned',
    example: true,
  })
  @IsBoolean()
  isBanned: boolean;

  @ApiPropertyOptional({
    description: 'Optional reason for banning or unbanning the user',
    example: 'Violation of platform community guidelines',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
