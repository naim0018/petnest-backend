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
import { CreateBookDto, UpdateBookDto } from './dto/book.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { BooksService } from './books.service';

@ApiTags('Marketplace - Books')
@Controller('marketplace/books')
export class BooksController {
  constructor(private readonly service: BooksService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Create pet book listing' })
  create(@Body() dto: CreateBookDto, @CurrentUser() user: any) {
    return this.service.create(dto, user?.id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List book listings' })
  findAll(@Query() query: ListingQueryDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user?.role);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get single book listing' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user?.role);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Update book listing' })
  update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Delete book listing' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
