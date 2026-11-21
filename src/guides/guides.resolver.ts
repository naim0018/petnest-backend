import { Args, Context, Int, Query, Resolver } from '@nestjs/graphql';
import { GuideType } from 'prisma/generated/prisma/enums';
import { GuideSortColumn } from './dto/guide-query.dto';
import { GuideExplorerService } from './guide-explorer.service';
import {
  BreedGuidesResponseModel,
  GuidePublicDetailResponseModel,
  GuideSummaryModel,
  PaginatedGuidesModel,
  SpeciesGuidesResponseModel,
} from './models/guide.model';

@Resolver(() => GuideSummaryModel)
export class GuidesResolver {
  constructor(private readonly explorerService: GuideExplorerService) {}

  @Query(() => PaginatedGuidesModel, { name: 'guides' })
  async getGuides(
    @Args('species', { type: () => String, nullable: true }) species?: string,
    @Args('breed', { type: () => String, nullable: true }) breed?: string,
    @Args('category', { type: () => String, nullable: true }) category?: string,
    @Args('type', { type: () => GuideType, nullable: true }) type?: GuideType,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('isFeatured', { type: () => Boolean, nullable: true })
    isFeatured?: boolean,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('sortBy', { type: () => String, nullable: true }) sortBy?: string,
    @Args('sortOrder', { type: () => String, nullable: true })
    sortOrder?: 'asc' | 'desc',
    @Context() context?: any,
  ) {
    const viewerId = context?.req?.user?.userId;
    return this.explorerService.findAllPublic(
      {
        species,
        breed,
        category,
        type,
        search,
        isFeatured,
        page: page ?? 1,
        limit: limit ?? 12,
        sortBy: (sortBy as GuideSortColumn) ?? 'publishedAt',
        sortOrder: sortOrder ?? 'desc',
      },
      viewerId,
    );
  }

  @Query(() => GuidePublicDetailResponseModel, {
    name: 'guide',
    nullable: true,
  })
  async getGuide(
    @Args('slug', { type: () => String }) slug: string,
    @Context() context?: any,
  ) {
    const req = context?.req;
    const viewerId = req?.user?.userId;
    const visitorHeader = req?.headers?.['x-visitor-id'];
    const visitorKey =
      viewerId ||
      (typeof visitorHeader === 'string' && visitorHeader.slice(0, 64)) ||
      req?.ip ||
      'anon';

    return this.explorerService.findOnePublicBySlug(
      slug,
      viewerId,
      visitorKey,
    );
  }

  @Query(() => SpeciesGuidesResponseModel, {
    name: 'guidesBySpecies',
    nullable: true,
  })
  async getGuidesBySpecies(
    @Args('speciesIdOrSlug', { type: () => String }) speciesIdOrSlug: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.explorerService.findGuidesBySpecies(speciesIdOrSlug, {
      page: page ?? 1,
      limit: limit ?? 10,
      search,
    });
  }

  @Query(() => BreedGuidesResponseModel, {
    name: 'guidesByBreed',
    nullable: true,
  })
  async getGuidesByBreed(
    @Args('breedIdOrSlug', { type: () => String }) breedIdOrSlug: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.explorerService.findGuidesByBreed(breedIdOrSlug, {
      page: page ?? 1,
      limit: limit ?? 10,
      search,
    });
  }
}
