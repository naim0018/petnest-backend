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
import { CreatePetFoodDto, UpdatePetFoodDto } from './dto/pet-food.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { PetFoodService } from './pet-food.service';

@ApiTags('Marketplace - Pet Food')
@Controller('marketplace/food')
export class PetFoodController {
  constructor(private readonly service: PetFoodService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Create pet food listing' })
  create(@Body() dto: CreatePetFoodDto, @CurrentUser() user: any) {
    return this.service.create(dto, user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List pet food listings' })
  findAll(@Query() query: ListingQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single pet food listing' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Update pet food listing' })
  update(@Param('id') id: string, @Body() dto: UpdatePetFoodDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Delete pet food listing' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
