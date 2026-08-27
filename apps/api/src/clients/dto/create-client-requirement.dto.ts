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

/**
 * Hard (must-have) vs. soft (nice-to-have) criteria: every field here
 * except `requiredFeatures`/`preferredFeatures` and the `title`/`notes`
 * text fields is a hard filter evaluated by MatchingService — a
 * property failing one is excluded from match results entirely.
 * `requiredFeatures` is ALSO hard (missing one excludes a property);
 * `preferredFeatures` is the one purely soft category — it raises a
 * match's score but never excludes. See docs/PERMISSIONS.md "Matching
 * hard vs. soft criteria."
 *
 * Every array field defaults to empty, meaning "no constraint on this
 * dimension" (e.g. an empty `cities` accepts any city). `countries`,
 * `cities`, and `areas` are combined with OR, not AND, when more than
 * one is set — a client accepting "Jounieh, Kaslik, Zouk Mikael" lists
 * those across `cities`/`areas` and a property need only match one.
 */
export class CreateClientRequirementDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsIn(LISTING_PURPOSES)
  listingPurpose!: (typeof LISTING_PURPOSES)[number];

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

  /** Required (checked in the service) whenever `minPrice`/`maxPrice` is set — prices are never compared across currencies. */
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
}

/** Shared bound-order validation — both create and update DTOs use this from ClientRequirementsService. */
export function assertValidBounds(dto: {
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minAreaSqm?: number;
  maxAreaSqm?: number;
  currency?: string;
}): string | null {
  if (
    dto.minPrice !== undefined &&
    dto.maxPrice !== undefined &&
    dto.minPrice > dto.maxPrice
  ) {
    return 'minPrice must be less than or equal to maxPrice.';
  }
  if (
    dto.minBedrooms !== undefined &&
    dto.maxBedrooms !== undefined &&
    dto.minBedrooms > dto.maxBedrooms
  ) {
    return 'minBedrooms must be less than or equal to maxBedrooms.';
  }
  if (
    dto.minAreaSqm !== undefined &&
    dto.maxAreaSqm !== undefined &&
    dto.minAreaSqm > dto.maxAreaSqm
  ) {
    return 'minAreaSqm must be less than or equal to maxAreaSqm.';
  }
  if (
    (dto.minPrice !== undefined || dto.maxPrice !== undefined) &&
    !dto.currency
  ) {
    return 'currency is required whenever minPrice or maxPrice is set.';
  }
  return null;
}
