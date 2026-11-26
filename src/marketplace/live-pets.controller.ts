import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decerator';
import { Roles } from 'src/common/decorators/roles.decoretors';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { CreateLivePetDto, UpdateLivePetDto } from './dto/live-pet.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { LivePetsService } from './live-pets.service';

@ApiTags('Marketplace - Live Pets')
@Controller('marketplace/pets')
export class LivePetsController {
  constructor(private readonly service: LivePetsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Create live pet listing' })
  create(@Body() dto: CreateLivePetDto, @CurrentUser() user: any) {
    return this.service.create(dto, user?.id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List live pet listings' })
  findAll(@Query() query: ListingQueryDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user?.role);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get single live pet listing' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user?.role);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Update live pet listing' })
  update(@Param('id') id: string, @Body() dto: UpdateLivePetDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Delete live pet listing' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
