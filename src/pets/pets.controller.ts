import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decoretors';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { BreedQueryDto } from './dto/breed-query.dto';
import { CreateBreedDto } from './dto/create-breed.dto';
import { CreateSpeciesDto } from './dto/create-species.dto';
import { SpeciesQueryDto } from './dto/species-query.dto';
import { UpdateBreedDto } from './dto/update-breed.dto';
import { UpdateSpeciesDto } from './dto/update-species.dto';
import { PetsService } from './pets.service';

@ApiTags('pets')
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Get('species')
  @ApiOperation({ summary: 'Get all pet species with their breeds (paginated)' })
  findAllSpecies(@Query() query: SpeciesQueryDto) {
    return this.petsService.findAllSpecies(query);
  }

  @Get('species/:id')
  @ApiOperation({ summary: 'Get a single species by ID or slug' })
  findOneSpecies(@Param('id') id: string) {
    return this.petsService.findOneSpecies(id);
  }

  @Get('breeds')
  @ApiOperation({ summary: 'Get all breeds (paginated, filter by speciesId/search)' })
  findAllBreeds(@Query() query: BreedQueryDto) {
    return this.petsService.findAllBreeds(query);
  }

  @Get('breeds/:id')
  @ApiOperation({ summary: 'Get a single breed by ID or slug' })
  findOneBreed(@Param('id') id: string) {
    return this.petsService.findOneBreed(id);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Post('species')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Create a new pet species' })
  createSpecies(@Body() dto: CreateSpeciesDto) {
    return this.petsService.createSpecies(dto);
  }

  @Patch('species/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Update a pet species' })
  updateSpecies(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpeciesDto,
  ) {
    return this.petsService.updateSpecies(id, dto);
  }

  @Delete('species/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Delete a pet species' })
  removeSpecies(@Param('id', ParseUUIDPipe) id: string) {
    return this.petsService.removeSpecies(id);
  }

  @Post('breeds')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Create a new pet breed' })
  createBreed(@Body() dto: CreateBreedDto) {
    return this.petsService.createBreed(dto);
  }

  @Patch('breeds/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Update a pet breed' })
  updateBreed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBreedDto,
  ) {
    return this.petsService.updateBreed(id, dto);
  }

  @Delete('breeds/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Delete a pet breed' })
  removeBreed(@Param('id', ParseUUIDPipe) id: string) {
    return this.petsService.removeBreed(id);
  }
}
