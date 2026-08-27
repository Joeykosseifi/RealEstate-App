import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PROPERTY_FEATURE_KEYS } from '../property-features.catalog';

/** A single `?features=x` query value arrives as a plain string, not an array — normalize before validating. */
function toArray({ value }: { value: unknown }): unknown {
  return Array.isArray(value) ? value : [value];
}

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

const PROPERTY_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'SOLD',
  'RENTED',
  'OFF_MARKET',
  'ARCHIVED',
] as const;

const SORT_ORDERS = ['asc', 'desc'] as const;

export class ListPropertiesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  /** Matched (case-insensitively) against title, city, area, and address. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: (typeof PROPERTY_TYPES)[number];

  @IsOptional()
  @IsIn(LISTING_PURPOSES)
  listingPurpose?: (typeof LISTING_PURPOSES)[number];

  @IsOptional()
  @IsIn(PROPERTY_STATUSES)
  propertyStatus?: (typeof PROPERTY_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedroomsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathroomsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  areaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  areaMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(PROPERTY_FEATURE_KEYS, { each: true })
  features?: string[];

  @IsOptional()
  @IsUUID()
  createdByUserId?: string;

  /**
   * Whether ARCHIVED properties are included. Defaults to false — the
   * everyday list view is the active roster, not the archive. Pass
   * `true` to see only-archived by also setting `propertyStatus=ARCHIVED`,
   * or `includeArchived=true` alongside no `propertyStatus` filter to see
   * everything.
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean = false;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: (typeof SORT_ORDERS)[number] = 'desc';
}
