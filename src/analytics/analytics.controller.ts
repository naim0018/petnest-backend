import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decoretors';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('visitors')
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Get site visitor metrics, geographic distribution & recent session logs',
  })
  async getVisitorAnalytics() {
    return this.analyticsService.getVisitorAnalytics();
  }
}
