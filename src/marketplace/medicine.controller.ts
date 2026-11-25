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
import { CreateMedicineDto, UpdateMedicineDto } from './dto/medicine.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { MedicineService } from './medicine.service';

@ApiTags('Marketplace - Medicine & Healthcare')
@Controller('marketplace/medicine')
export class MedicineController {
  constructor(private readonly service: MedicineService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Create medicine listing' })
  create(@Body() dto: CreateMedicineDto, @CurrentUser() user: any) {
    return this.service.create(dto, user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List medicine listings' })
  findAll(@Query() query: ListingQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single medicine listing' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Update medicine listing' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Delete medicine listing' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
