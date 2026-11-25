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
import { RoleGuard } from 'src/common/guards/role.guard';
import { CreateAccessoryDto, UpdateAccessoryDto } from './dto/accessory.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { AccessoriesService } from './accessories.service';

@ApiTags('Marketplace - Accessories & Gear')
@Controller('marketplace/accessories')
export class AccessoriesController {
  constructor(private readonly service: AccessoriesService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Create pet accessory listing' })
  create(@Body() dto: CreateAccessoryDto, @CurrentUser() user: any) {
    return this.service.create(dto, user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List accessory listings' })
  findAll(@Query() query: ListingQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single accessory listing' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Update accessory listing' })
  update(@Param('id') id: string, @Body() dto: UpdateAccessoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Delete accessory listing' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
