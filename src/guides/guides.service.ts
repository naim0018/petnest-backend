import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from 'src/common/guards/jwt-auth.guard';
import { CreateGuideDto } from './dto/create-guide.dto';
import { GuideQueryDto } from './dto/guide-query.dto';
import { ReviewGuideDto } from './dto/review-guide.dto';
import { UpdateGuideDto } from './dto/update-guide.dto';
import { BulkImportZipResponse } from './dto/bulk-import-guide.dto';
import { GuideExplorerService } from './guide-explorer.service';
import { GuideEditorialService } from './guide-editorial.service';
import { GuideEngagementService } from './guide-engagement.service';

export {
  guideSummarySelect,
  RESERVED_GUIDE_SLUGS,
  EDITORIAL_REVIEWER_ROLES,
  AUTHOR_ALLOWED_STATUSES,
  slugify,
  escapeHtml,
} from './constants/guide.constants';

/**
 * Facade Service for Guides domain.
 * Orchestrates calls between GuideExplorerService, GuideEditorialService, and GuideEngagementService.
 * Maintains 100% backward compatibility for all existing controllers and consumers.
 */
@Injectable()
export class GuidesService {
  constructor(
    private readonly explorerService: GuideExplorerService,
    private readonly editorialService: GuideEditorialService,
    private readonly engagementService: GuideEngagementService,
  ) {}

  // ==================== EDITORIAL CRUD & WORKFLOW ====================

  create(dto: CreateGuideDto, requester: AuthenticatedUser) {
    return this.editorialService.create(dto, requester);
  }

  update(id: string, dto: UpdateGuideDto, requester: AuthenticatedUser) {
    return this.editorialService.update(id, dto, requester);
  }

  reviewGuide(id: string, dto: ReviewGuideDto, reviewer: AuthenticatedUser) {
    return this.editorialService.reviewGuide(id, dto, reviewer);
  }

  findAllEditorial(query: GuideQueryDto, requester: AuthenticatedUser) {
    return this.editorialService.findAllEditorial(query, requester);
  }

  findOneEditorial(id: string, requester: AuthenticatedUser) {
    return this.editorialService.findOneEditorial(id, requester);
  }

  getEditorialStats() {
    return this.editorialService.getEditorialStats();
  }

  softDelete(id: string, requester: AuthenticatedUser) {
    return this.editorialService.softDelete(id, requester);
  }

  bulkImportFromZip(
    zipBuffer: Buffer,
    requester: AuthenticatedUser,
  ): Promise<BulkImportZipResponse> {
    return this.editorialService.bulkImportFromZip(zipBuffer, requester);
  }

  exportGuideAsZip(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    return this.editorialService.exportGuideAsZip(id, requester);
  }

  importGuideZip(
    id: string,
    zipBuffer: Buffer,
    requester: AuthenticatedUser,
  ): Promise<any> {
    return this.editorialService.importGuideZip(id, zipBuffer, requester);
  }

  // ==================== PUBLIC EXPLORER ====================

  findAllPublic(query: GuideQueryDto, viewerId?: string, targetLang = 'en') {
    return this.explorerService.findAllPublic(query, viewerId, targetLang);
  }

  getSliderGuides(species?: string, breed?: string, viewerId?: string, targetLang = 'en') {
    return this.explorerService.getSliderGuides(species, breed, viewerId, targetLang);
  }

  findOnePublicBySlug(
    slug: string,
    viewerId?: string,
    visitorKey = 'anon',
    targetLang = 'en',
  ) {
    return this.explorerService.findOnePublicBySlug(
      slug,
      viewerId,
      visitorKey,
      targetLang,
    );
  }

  findGuidesBySpecies(speciesIdOrSlug: string, query?: GuideQueryDto) {
    return this.explorerService.findGuidesBySpecies(speciesIdOrSlug, query);
  }

  findGuidesByBreed(breedIdOrSlug: string, query?: GuideQueryDto) {
    return this.explorerService.findGuidesByBreed(breedIdOrSlug, query);
  }

  findRelatedGuides(idOrSlug: string, limit?: number, targetLang = 'en') {
    return this.explorerService.findRelatedGuides(idOrSlug, limit, targetLang);
  }

  // ==================== USER ENGAGEMENT ====================

  toggleLike(guideId: string, userId: string) {
    return this.engagementService.toggleLike(guideId, userId);
  }

  toggleBookmark(guideId: string, userId: string) {
    return this.engagementService.toggleBookmark(guideId, userId);
  }

  getMyBookmarks(userId: string, page = 1, limit = 12) {
    return this.engagementService.getMyBookmarks(userId, page, limit);
  }

  getMyLikes(userId: string, page = 1, limit = 12) {
    return this.engagementService.getMyLikes(userId, page, limit);
  }

  getComments(guideId: string) {
    return this.engagementService.getComments(guideId);
  }

  createComment(
    guideId: string,
    userId: string,
    content: string,
    parentId?: string,
  ) {
    return this.engagementService.createComment(
      guideId,
      userId,
      content,
      parentId,
    );
  }

  updateComment(commentId: string, userId: string, content: string) {
    return this.engagementService.updateComment(commentId, userId, content);
  }

  deleteComment(commentId: string, userId: string, userRole?: string) {
    return this.engagementService.deleteComment(commentId, userId, userRole);
  }
}
