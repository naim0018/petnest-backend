import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateGoogleOAuthDto {
  @ApiPropertyOptional({
    description: 'Google Cloud OAuth 2.0 Client ID',
    example: '1234567890-abcdef.apps.googleusercontent.com',
  })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({
    description: 'Google Cloud OAuth 2.0 Client Secret (encrypted via AES-256-GCM)',
    example: 'GOCSPX-xxxxxxxxxxxxxx',
  })
  @IsString()
  @IsOptional()
  clientSecret?: string;

  @ApiPropertyOptional({
    description: 'Whether Google Sign-In is enabled on login/signup pages',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
