import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PROPERTY_FEATURE_KEYS } from '../../properties/property-features.catalog';

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

/** `ARCHIVED` is reached only via the dedicated archive endpoint, not here. */
const STATUSES = ['ACTIVE', 'PAUSED', 'FULFILLED'] as const;

/** `clientId`/`workspaceId`/`createdByUserId` are structurally unreachable here — see `CreateClientRequirementDto` for the hard/soft criteria rationale. */
export class UpdateClientRequirementDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsIn(LISTING_PURPOSES)
  listingPurpose?: (typeof LISTING_PURPOSES)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PROPERTY_TYPES, { each: true })
  propertyTypes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAreaSqm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAreaSqm?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  countries?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  cities?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  areas?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PROPERTY_FEATURE_KEYS, { each: true })
  requiredFeatures?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PROPERTY_FEATURE_KEYS, { each: true })
  preferredFeatures?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
