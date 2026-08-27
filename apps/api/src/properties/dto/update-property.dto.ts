import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PROPERTY_FEATURE_KEYS } from '../property-features.catalog';
import { PropertyLocationDto } from './property-location.dto';
import { PropertyOwnerDto } from './property-owner.dto';
import { PropertyPrivateDetailsDto } from './property-private-details.dto';

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

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Deliberately has no `workspaceId`, `createdByUserId`, or `id` field —
 * there is no way to submit them, so there is no way to reassign a
 * property to a different workspace or forge its author through this
 * endpoint (the global `ValidationPipe` also has
 * `forbidNonWhitelisted: true`, so submitting them anyway is a `400`,
 * not a silently-ignored no-op). `propertyStatus` is intentionally
 * excluded too — status transitions go through the dedicated
 * `POST .../status` / `.../archive` / `.../restore` endpoints so the
 * transition rules in PropertiesService are never bypassed by a plain
 * field update.
 *
 * Nested sections (`location`/`owners`/`privateDetails`/`featureKeys`)
 * use whole-section replace semantics when present: submitting
 * `owners: [...]` replaces every existing owner row for the property,
 * it does not merge. Omitting a section entirely leaves it untouched.
 */
export class UpdatePropertyDto {
  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: (typeof PROPERTY_TYPES)[number];

  @IsOptional()
  @IsIn(LISTING_PURPOSES)
  listingPurpose?: (typeof LISTING_PURPOSES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  areaSqm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalFloors?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(CURRENT_YEAR + 1)
  yearBuilt?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PROPERTY_FEATURE_KEYS, { each: true })
  featureKeys?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyLocationDto)
  location?: PropertyLocationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyOwnerDto)
  owners?: PropertyOwnerDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyPrivateDetailsDto)
  privateDetails?: PropertyPrivateDetailsDto;
}
