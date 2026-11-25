import {
  BadRequestException,
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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decerator';
import { Roles } from 'src/common/decorators/roles.decoretors';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { CreateGuideCategoryDto } from './dto/create-category.dto';
import { BulkCreateGuideFaqDto, CreateGuideFaqDto } from './dto/create-faq.dto';
import { CreateGuideDto } from './dto/create-guide.dto';
import { GenerateGuideAiDto } from './dto/generate-guide-ai.dto';
import { GuideQueryDto } from './dto/guide-query.dto';
import { ReviewGuideDto } from './dto/review-guide.dto';
import { UpdateGuideCategoryDto } from './dto/update-category.dto';
import { UpdateGuideFaqDto } from './dto/update-faq.dto';
import { UpdateGuideDto } from './dto/update-guide.dto';
import { GuideAiService } from './guide-ai.service';
import { GuideCategoriesService } from './guide-categories.service';
import { GuideFaqsService } from './guide-faqs.service';
import { GuidesService } from './guides.service';
import { resolveTargetLocale } from './constants/guide.constants';

@ApiTags('guides')
@Controller('guides')
export class GuidesController {
  constructor(
    private readonly categoriesService: GuideCategoriesService,
    private readonly faqsService: GuideFaqsService,
    private readonly guidesService: GuidesService,
    private readonly guideAiService: GuideAiService,
  ) {}

  // ==================== CATEGORIES ====================

  @Get('categories')
  @ApiOperation({
    summary: 'Public: Get active guide categories for topic filter bar',
  })
  @ApiQuery({ name: 'excludeBasic', required: false, type: Boolean })
  findAllCategoriesPublic(@Query('excludeBasic') excludeBasic?: string) {
    return this.categoriesService.findAllPublic(excludeBasic === 'true');
  }

  @Get('categories/:idOrSlug')
  @ApiOperation({
    summary: 'Public: Get a single guide category by ID or slug',
  })
  findOneCategory(@Param('idOrSlug') idOrSlug: string) {
    return this.categoriesService.findOne(idOrSlug);
  }

  @Get('admin/categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Admin: Get all categories with guide counts & views',
  })
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
  @ApiOperation({
    summary: 'Public: Get active FAQs by species (UUID/slug) or guideId',
  })
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

  @Post('faqs/bulk')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Bulk-create multiple FAQs for a species or guide' })
  createFaqsBulk(
    @Body() dto: BulkCreateGuideFaqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.faqsService.createBulk(dto, user);
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

  // ==================== ALL GUIDES & REVIEW QUEUE ====================

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      'Editorial & Admin Hub: Get summary counts, chart trends & total readership',
  })
  getGuideOverviewStats() {
    return this.guidesService.getEditorialStats();
  }

  @Get('editorial/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Editorial Hub: Get summary counts & total readership',
  })
  getEditorialStats() {
    return this.guidesService.getEditorialStats();
  }

  @Get('all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      'All Guides: List all guides (Admins/Superadmins only)',
  })
  findAllGuides(
    @Query() query: GuideQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.findAllEditorial(query, user);
  }

  @Get('editorial')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      'Editorial: List all guides (Admins/Superadmins only)',
  })
  findAllEditorial(
    @Query() query: GuideQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.findAllEditorial(query, user);
  }

  @Get('all/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Get full guide details by ID (Admins/Superadmins only)',
  })
  findOneGuide(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guidesService.findOneEditorial(id, user);
  }

  @Get('editorial/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Editorial: Get full guide details by ID (Admins/Superadmins only)',
  })
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

  @Get('slider')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Public: Get basic guides for top interactive slider by species & breed',
  })
  @ApiQuery({ name: 'species', required: false })
  @ApiQuery({ name: 'breed', required: false })
  @ApiQuery({ name: 'lang', required: false })
  getSliderGuides(
    @Query('species') species: string | undefined,
    @Query('breed') breed: string | undefined,
    @Query('lang') lang: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') viewerId?: string,
  ) {
    res.setHeader('Vary', 'Origin, Cookie, x-visitor-lang, x-timezone');
    const { targetLang } = resolveTargetLocale(req);
    const resolvedLang = lang || targetLang;
    return this.guidesService.getSliderGuides(species, breed, viewerId, resolvedLang);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Public Explorer: Filter published guides by species, breed, category, search, or featured',
  })
  findAllPublic(
    @Query() query: GuideQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') viewerId?: string,
  ) {
    res.setHeader('Vary', 'Origin, Cookie, x-visitor-lang, x-timezone');
    const { targetLang } = resolveTargetLocale(req);
    return this.guidesService.findAllPublic(query, viewerId, targetLang);
  }

  // ==================== GUIDES BY SPECIES OR BREED ====================

  @Get('species/:speciesIdOrSlug')
  @ApiOperation({ summary: 'Get all guides targeting a specific species' })
  findGuidesBySpecies(
    @Param('speciesIdOrSlug') speciesIdOrSlug: string,
    @Query() query: GuideQueryDto,
  ) {
    return this.guidesService.findGuidesBySpecies(speciesIdOrSlug, query);
  }

  @Get('breed/:breedIdOrSlug')
  @ApiOperation({ summary: 'Get all guides targeting a specific breed only' })
  findGuidesByBreed(
    @Param('breedIdOrSlug') breedIdOrSlug: string,
    @Query() query: GuideQueryDto,
  ) {
    return this.guidesService.findGuidesByBreed(breedIdOrSlug, query);
  }

  @Get(':idOrSlug/related')
  @ApiOperation({
    summary:
      'Public: Get related guides prioritized by similar category -> breed -> species fallback',
  })
  findRelatedGuides(
    @Param('idOrSlug') idOrSlug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('limit') limit?: number,
  ) {
    res.setHeader('Vary', 'Origin, Cookie, x-visitor-lang, x-timezone');
    const { targetLang } = resolveTargetLocale(req);
    return this.guidesService.findRelatedGuides(
      idOrSlug,
      limit ? Number(limit) : 4,
      targetLang,
    );
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
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') viewerId?: string,
  ) {
    res.setHeader('Vary', 'Origin, Cookie, x-visitor-lang, x-timezone');
    const visitorHeader = req.headers['x-visitor-id'];
    const visitorKey =
      viewerId ||
      (typeof visitorHeader === 'string' && visitorHeader.slice(0, 64)) ||
      req.ip ||
      'anon';

    const { targetLang } = resolveTargetLocale(req);

    return this.guidesService.findOnePublicBySlug(
      slug,
      viewerId,
      visitorKey,
      targetLang,
    );
  }

  // ==================== EDITORIAL MUTATIONS ====================

  @Post('generate-ai')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      'Generate structured guide, body HTML, image prompts, and FAQs using Gemini AI',
  })
  generateGuideAi(
    @Body() dto: GenerateGuideAiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guideAiService.generate(dto, user);
  }

  @Post('bulk-import-zip')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max archive upload
      fileFilter: (_req, file, callback) => {
        const isZip =
          file.mimetype === 'application/zip' ||
          file.mimetype === 'application/x-zip-compressed' ||
          file.mimetype === 'application/octet-stream' ||
          file.originalname.toLowerCase().endsWith('.zip');
        if (!isZip) {
          return callback(
            new BadRequestException('Only .zip archive files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Bulk Import (.zip): Extract images, upload to media storage, map tokens, and batch-create guides with FAQs',
  })
  bulkImportFromZip(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('A .zip archive file is required');
    }
    return this.guidesService.bulkImportFromZip(file.buffer, user);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary: 'Create a new guide (Draft, In Review, or Published)',
  })
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

  @Get(':id/export-zip')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      'Export a guide as an archive ZIP file containing guides.json and images/',
  })
  async exportGuideZip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.guidesService.exportGuideAsZip(
      id,
      user,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  }

  @Post(':id/import-zip')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('AUTHOR', 'VET', 'ADMIN', 'SUPERADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Update an existing guide from an uploaded ZIP archive',
  })
  importGuideZip(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('A .zip archive file is required');
    }
    return this.guidesService.importGuideZip(id, file.buffer, user);
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
