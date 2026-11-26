import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decerator';
import { Roles } from 'src/common/decorators/roles.decoretors';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { TestGeminiKeyDto } from './dto/test-gemini-key.dto';
import { UpdateGeminiKeyDto } from './dto/update-gemini-key.dto';
import { UpdateGoogleOAuthDto } from './dto/update-google-oauth.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('ADMIN', 'SUPERADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('gemini')
  @ApiOperation({
    summary: 'Get Gemini AI configuration status and masked API key',
  })
  async getGeminiConfig() {
    return this.settingsService.getGeminiConfig();
  }

  @Post('gemini')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Securely save Gemini API key encrypted with AES-256-GCM',
  })
  async saveGeminiKey(
    @Body() dto: UpdateGeminiKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.saveGeminiKey(dto.apiKey, user.userId);
  }

  @Delete('gemini')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove Gemini API key from database',
  })
  async removeGeminiKey() {
    return this.settingsService.removeGeminiKey();
  }

  @Post('gemini/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test Gemini API key connectivity against Google AI endpoints',
  })
  async testGemini(@Body() dto: TestGeminiKeyDto) {
    return this.settingsService.testGeminiConnectivity(dto.apiKey);
  }

  // ==========================================
  // GOOGLE OAUTH CONFIGURATION ENDPOINTS
  // ==========================================

  @Get('google-oauth')
  @ApiOperation({
    summary: 'Get Google OAuth 2.0 configuration status and masked Client Secret',
  })
  async getGoogleOAuthConfig() {
    return this.settingsService.getGoogleOAuthConfig();
  }

  @Post('google-oauth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save Google OAuth Client ID and Secret (AES-256-GCM encrypted)',
  })
  async saveGoogleOAuthConfig(
    @Body() dto: UpdateGoogleOAuthDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.saveGoogleOAuthConfig(dto, user.userId);
  }

  @Delete('google-oauth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove Google OAuth configuration from database',
  })
  async removeGoogleOAuthConfig() {
    return this.settingsService.removeGoogleOAuthConfig();
  }
}
