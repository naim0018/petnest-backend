import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decerator';
import { Roles } from 'src/common/decorators/roles.decoretors';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { CreateGuideCategoryDto } from './dto/create-category.dto';
import { CreateGuideFaqDto } from './dto/create-faq.dto';
import { CreateGuideDto } from './dto/create-guide.dto';
import { GuideQueryDto } from './dto/guide-query.dto';
import { ReviewGuideDto } from './dto/review-guide.dto';
import { UpdateGuideCategoryDto } from './dto/update-category.dto';
import { UpdateGuideFaqDto } from './dto/update-faq.dto';
import { UpdateGuideDto } from './dto/update-guide.dto';
import { GuideCategoriesService } from './guide-categories.service';
import { GuideFaqsService } from './guide-faqs.service';
import { GuidesService } from './guides.service';

@ApiTags('guides')
@Controller('guides')
export class GuidesController {
  constructor(
    private readonly categoriesService: GuideCategoriesService,
    private readonly faqsService: GuideFaqsService,
    private readonly guidesService: GuidesService,
  ) {}

  // ==================== CATEGORIES ====================

  @Get('categories')
  @ApiOperation({ summary: 'Public: Get active guide categories for topic filter bar' })
  findAllCategoriesPublic() {
    return this.categoriesService.findAllPublic();
  }

  @Get('categories/:idOrSlug')
  @ApiOperation({ summary: 'Public: Get a single guide category by ID or slug' })
  findOneCategory(@Param('idOrSlug') idOrSlug: string) {
    return this.categoriesService.findOne(idOrSlug);
  }

  @Get('admin/categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Get all categories with guide counts & views' })
  @ApiQuery({ name: 'search', required: false })
  findAllCategoriesAdmin(@Query('search') search?: string) {
    return this.categoriesService.findAllAdmin(search);
  }

  @Post('categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Create a guide category' })
  createCategory(@Body() dto: CreateGuideCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch('categories/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Update a guide category' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuideCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Admin: Delete an empty guide category' })
  removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }

  // ==================== FAQS ====================

  @Get('faqs')
  @ApiOperation({ summary: 'Public: Get active FAQs by species (UUID/slug) or guideId' })
  @ApiQuery({ name: 'species', required: false })
  @ApiQuery({ name: 'guideId', required: false })
  findAllFaqsPublic(
    @Query('species') species?: string,
    @Query('guideId') guideId?: string,
  ) {
    return this.faqsService.findAllPublic(species, guideId);
  }

  @Get('admin/faqs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Admin/Vet: Get all FAQs including inactive' })
  @ApiQuery({ name: 'species', required: false })
  @ApiQuery({ name: 'guideId', required: false })
  findAllFaqsAdmin(
    @Query('species') species?: string,
    @Query('guideId') guideId?: string,
  ) {
    return this.faqsService.findAllAdmin(species, guideId);
  }

  @Post('faqs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Create a species FAQ or article FAQ' })
  createFaq(
    @Body() dto: CreateGuideFaqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.faqsService.create(dto, user);
  }

  @Patch('faqs/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Update an FAQ' })
  updateFaq(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuideFaqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.faqsService.update(id, dto, user);
  }

  @Delete('faqs/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Delete an FAQ' })
  removeFaq(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.faqsService.remove(id, user);
  }

  // ==================== EDITORIAL GUIDES & REVIEW QUEUE ====================

  @Get('editorial/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Editorial Hub: Get summary counts & total readership' })
  getEditorialStats() {
    return this.guidesService.getEditorialStats();
  }

  @Get('editorial')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      'Editorial: List guides (Vets/Admins see all + Review Queue; Authors see own drafts)',
  })
  findAllEditorial(
    @Query() query: GuideQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.findAllEditorial(query, user);
  }

  @Get('editorial/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Editorial: Get full guide details by ID for editing/review' })
  findOneEditorial(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.findOneEditorial(id, user);
  }

  // ==================== USER BOOKMARKS & LIKES ====================

  @Get('me/bookmarks')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get logged-in user saved/bookmarked guides' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMyBookmarks(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.guidesService.getMyBookmarks(userId, page, limit);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle like on a published guide' })
  toggleLike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.guidesService.toggleLike(id, userId);
  }

  @Post(':id/bookmark')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle bookmark/save on a published guide' })
  toggleBookmark(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.guidesService.toggleBookmark(id, userId);
  }

  // ==================== PUBLIC GUIDE EXPLORER & DETAIL ====================

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Public Explorer: Filter published guides by species, breed, category, search, or featured',
  })
  findAllPublic(
    @Query() query: GuideQueryDto,
    @CurrentUser('userId') viewerId?: string,
  ) {
    return this.guidesService.findAllPublic(query, viewerId);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Public Detail: Get published guide by slug (supports previousSlugs redirect + related guides)',
  })
  findOnePublicBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
    @CurrentUser('userId') viewerId?: string,
  ) {
    const visitorHeader = req.headers['x-visitor-id'];
    const visitorKey =
      viewerId ||
      (typeof visitorHeader === 'string' && visitorHeader.slice(0, 64)) ||
      req.ip ||
      'anon';

    return this.guidesService.findOnePublicBySlug(slug, viewerId, visitorKey);
  }

  // ==================== EDITORIAL MUTATIONS ====================

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Create a new guide (Draft, In Review, or Published)' })
  createGuide(
    @Body() dto: CreateGuideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.create(dto, user);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Update a guide and re-sync inline R2 images' })
  updateGuide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.update(id, dto, user);
  }

  @Patch(':id/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      'Review Queue: Publish (with Expert Reviewed stamp), return for revision, or archive',
  })
  reviewGuide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewGuideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.reviewGuide(id, dto, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Soft-delete a guide' })
  softDeleteGuide(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.softDelete(id, user);
  }
}
