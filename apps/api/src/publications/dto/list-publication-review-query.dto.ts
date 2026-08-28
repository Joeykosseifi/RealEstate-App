import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'PUBLISHED',
  'REJECTED',
  'ADMIN_UNPUBLISHED',
  'OWNER_UNPUBLISHED',
  'ARCHIVED',
] as const;

const PROPERTY_TYPES = [
  'APARTMENT',
  'VILLA',
  'HOUSE',
  'LAND',
  'OFFICE',
  'SHOP',
  'COMMERCIAL',
  'WAREHOUSE',
  'BUILDING',
  'CHALET',
  'OTHER',
] as const;

const LISTING_PURPOSES = ['SALE', 'RENT'] as const;

/** Defaults to `PENDING_REVIEW`, oldest-first — the admin review queue's natural default (see PublicationsAdminService). */
export class ListPublicationReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: (typeof PROPERTY_TYPES)[number];

  @IsOptional()
  @IsIn(LISTING_PURPOSES)
  listingPurpose?: (typeof LISTING_PURPOSES)[number];

  @IsOptional()
  @IsUUID()
  submittedByUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
