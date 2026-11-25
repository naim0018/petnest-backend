import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import {
  HealthVerificationStatus,
  ListingStatus,
  LiveDeliveryMethod,
  PetGender,
} from 'prisma/generated/prisma/client';

export class CreateLivePetDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number = 1;

  @IsNotEmpty()
  @IsString()
  speciesId: string;

  @IsOptional()
  @IsString()
  breedId?: string;

  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender = PetGender.UNSEXED;

  @IsNotEmpty()
  @IsString()
  ageText: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  colorMutation?: string;

  @IsOptional()
  @IsString()
  ringNumber?: string;

  @IsOptional()
  @IsString()
  microchipId?: string;

  @IsOptional()
  @IsEnum(HealthVerificationStatus)
  healthStatus?: HealthVerificationStatus = HealthVerificationStatus.HEALTHY_UNVERIFIED;

  @IsOptional()
  @IsBoolean()
  dewormed?: boolean = false;

  @IsOptional()
  @IsBoolean()
  vaccinated?: boolean = false;

  @IsOptional()
  @IsString()
  dnaSexingCertUrl?: string;

  @IsOptional()
  @IsString()
  pedigreePaperUrl?: string;

  @IsOptional()
  @IsEnum(LiveDeliveryMethod)
  deliveryMethod?: LiveDeliveryMethod = LiveDeliveryMethod.LOCAL_PICKUP;

  @IsOptional()
  @IsBoolean()
  transitGuarantee?: boolean = false;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsNotEmpty()
  @IsString()
  coverImage: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[] = [];

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus = ListingStatus.DRAFT;

  @IsOptional()
  @IsString()
  storeName?: string = 'PetNest Official Direct';
}

export class UpdateLivePetDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  speciesId?: string;

  @IsOptional()
  @IsString()
  breedId?: string;

  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  @IsOptional()
  @IsString()
  ageText?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  colorMutation?: string;

  @IsOptional()
  @IsString()
  ringNumber?: string;

  @IsOptional()
  @IsString()
  microchipId?: string;

  @IsOptional()
  @IsEnum(HealthVerificationStatus)
  healthStatus?: HealthVerificationStatus;

  @IsOptional()
  @IsBoolean()
  dewormed?: boolean;

  @IsOptional()
  @IsBoolean()
  vaccinated?: boolean;

  @IsOptional()
  @IsString()
  dnaSexingCertUrl?: string;

  @IsOptional()
  @IsString()
  pedigreePaperUrl?: string;

  @IsOptional()
  @IsEnum(LiveDeliveryMethod)
  deliveryMethod?: LiveDeliveryMethod;

  @IsOptional()
  @IsBoolean()
  transitGuarantee?: boolean;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsString()
  storeName?: string;
}
