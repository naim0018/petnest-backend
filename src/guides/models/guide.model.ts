import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GuideType } from 'prisma/generated/prisma/enums';

registerEnumType(GuideType, { name: 'GuideType' });

@ObjectType('GuideCategorySummary')
export class GuideCategorySummaryModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  icon?: string;
}

@ObjectType('GuideSpeciesSummary')
export class GuideSpeciesSummaryModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  categoryIcon?: string;
}

@ObjectType('GuideBreedSummary')
export class GuideBreedSummaryModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  image?: string;
}

@ObjectType('GuideProfileSummary')
export class GuideProfileSummaryModel {
  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  specialization?: string;
}

@ObjectType('GuideAuthorSummary')
export class GuideAuthorSummaryModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  role: string;

  @Field(() => GuideProfileSummaryModel, { nullable: true })
  profile?: GuideProfileSummaryModel;
}

@ObjectType('GuideFaq')
export class GuideFaqModel {
  @Field(() => ID)
  id: string;

  @Field()
  question: string;

  @Field()
  answer: string;

  @Field(() => Int)
  displayOrder: number;
}

@ObjectType('GuideSummary')
export class GuideSummaryModel {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  slug: string;

  @Field()
  excerpt: string;

  @Field(() => GuideType)
  type: GuideType;

  @Field({ nullable: true })
  coverImage?: string;

  @Field({ nullable: true })
  coverImageAlt?: string;

  @Field({ nullable: true })
  videoUrl?: string;

  @Field(() => Int, { nullable: true })
  readTimeMinutes?: number;

  @Field(() => Int, { nullable: true })
  displayOrder?: number;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  isFeatured?: boolean;

  @Field(() => Date, { nullable: true })
  lastReviewedAt?: Date;

  @Field({ nullable: true })
  expertReviewed?: boolean;

  @Field(() => Int, { nullable: true })
  viewCount?: number;

  @Field(() => Int, { nullable: true })
  likeCount?: number;

  @Field(() => Int, { nullable: true })
  bookmarkCount?: number;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date;

  @Field(() => Date, { nullable: true })
  contentUpdatedAt?: Date;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;

  @Field(() => GuideCategorySummaryModel, { nullable: true })
  category?: GuideCategorySummaryModel;

  @Field(() => GuideSpeciesSummaryModel, { nullable: true })
  species?: GuideSpeciesSummaryModel;

  @Field(() => [GuideBreedSummaryModel], { nullable: 'itemsAndList' })
  breeds?: GuideBreedSummaryModel[];

  @Field(() => GuideAuthorSummaryModel, { nullable: true })
  author?: GuideAuthorSummaryModel;

  @Field(() => GuideAuthorSummaryModel, { nullable: true })
  reviewer?: GuideAuthorSummaryModel;

  @Field({ nullable: true })
  isLiked?: boolean;

  @Field({ nullable: true })
  isBookmarked?: boolean;
}

@ObjectType('GuidePaginationMeta')
export class GuidePaginationMetaModel {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPrevPage: boolean;
}

@ObjectType('PaginatedGuides')
export class PaginatedGuidesModel {
  @Field(() => [GuideSummaryModel])
  items: GuideSummaryModel[];

  @Field(() => GuidePaginationMetaModel)
  meta: GuidePaginationMetaModel;
}

@ObjectType('GuideDetail')
export class GuideDetailModel {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  slug: string;

  @Field()
  excerpt: string;

  @Field()
  content: string;

  @Field(() => [String], { nullable: true })
  keyTakeaways?: string[];

  @Field(() => GuideType)
  type: GuideType;

  @Field({ nullable: true })
  coverImage?: string;

  @Field({ nullable: true })
  coverImageAlt?: string;

  @Field({ nullable: true })
  faqImage?: string;

  @Field({ nullable: true })
  videoUrl?: string;

  @Field(() => Int, { nullable: true })
  readTimeMinutes?: number;

  @Field(() => Int, { nullable: true })
  displayOrder?: number;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  isFeatured?: boolean;

  @Field(() => Date, { nullable: true })
  lastReviewedAt?: Date;

  @Field({ nullable: true })
  expertReviewed?: boolean;

  @Field(() => Int, { nullable: true })
  viewCount?: number;

  @Field(() => Int, { nullable: true })
  likeCount?: number;

  @Field(() => Int, { nullable: true })
  bookmarkCount?: number;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date;

  @Field(() => Date, { nullable: true })
  contentUpdatedAt?: Date;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  metaTitle?: string;

  @Field({ nullable: true })
  metaDescription?: string;

  @Field(() => GuideCategorySummaryModel, { nullable: true })
  category?: GuideCategorySummaryModel;

  @Field(() => GuideSpeciesSummaryModel, { nullable: true })
  species?: GuideSpeciesSummaryModel;

  @Field(() => [GuideBreedSummaryModel], { nullable: 'itemsAndList' })
  breeds?: GuideBreedSummaryModel[];

  @Field(() => GuideAuthorSummaryModel, { nullable: true })
  author?: GuideAuthorSummaryModel;

  @Field(() => GuideAuthorSummaryModel, { nullable: true })
  reviewer?: GuideAuthorSummaryModel;

  @Field(() => [GuideFaqModel], { nullable: 'itemsAndList' })
  faqs?: GuideFaqModel[];

  @Field({ nullable: true })
  isLiked?: boolean;

  @Field({ nullable: true })
  isBookmarked?: boolean;
}

@ObjectType('GuidePublicDetailResponse')
export class GuidePublicDetailResponseModel {
  @Field({ nullable: true })
  redirectTo?: string;

  @Field(() => GuideDetailModel)
  guide: GuideDetailModel;

  @Field(() => [GuideSummaryModel])
  relatedGuides: GuideSummaryModel[];
}

@ObjectType('SpeciesGuidesResponse')
export class SpeciesGuidesResponseModel {
  @Field(() => GuideSpeciesSummaryModel)
  species: GuideSpeciesSummaryModel;

  @Field(() => [GuideSummaryModel])
  items: GuideSummaryModel[];

  @Field(() => GuidePaginationMetaModel)
  meta: GuidePaginationMetaModel;
}

@ObjectType('BreedGuidesResponse')
export class BreedGuidesResponseModel {
  @Field(() => GuideBreedSummaryModel)
  breed: GuideBreedSummaryModel;

  @Field(() => [GuideSummaryModel])
  items: GuideSummaryModel[];

  @Field(() => GuidePaginationMetaModel)
  meta: GuidePaginationMetaModel;
}
