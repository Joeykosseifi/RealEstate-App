import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PROPERTY_FEATURE_KEYS } from '../../properties/property-features.catalog';

/** A single `?features=x` query value arrives as a plain string, not an array — normalize before validating (same as ListPropertiesQueryDto). */
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
const SORTS = ['newest', 'price_asc', 'price_desc'] as const;

export class MarketplaceSearchQueryDto {
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
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: (typeof PROPERTY_TYPES)[number];

  @IsOptional()
  @IsIn(LISTING_PURPOSES)
  listingPurpose?: (typeof LISTING_PURPOSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
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
  @IsNumber()
  @Min(0)
  areaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

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
  @ArrayUnique()
  @IsIn(PROPERTY_FEATURE_KEYS, { each: true })
  features?: string[];

  @IsOptional()
  @IsIn(SORTS)
  sort?: (typeof SORTS)[number];
}
