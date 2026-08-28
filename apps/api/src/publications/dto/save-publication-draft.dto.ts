import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
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

const LOCATION_VISIBILITIES = [
  'PRIVATE',
  'WORKSPACE',
  'PUBLIC_APPROXIMATE',
  'PUBLIC_EXACT',
] as const;

const MAX_PUBLICATION_MEDIA = 20;

export class PublicationMediaSelectionDto {
  @IsUUID()
  propertyMediaId!: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

/**
 * The complete public-facing snapshot, submitted as a full replace every
 * time (see docs/PERMISSIONS.md "Publication draft editing") — never a
 * partial patch, so there is no merge ambiguity between what the
 * professional is currently editing and what was previously saved.
 */
export class SavePublicationDraftDto {
  @IsString()
  @Length(1, 200)
  publicTitle!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  publicDescription?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  publicPrice!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsIn(PROPERTY_TYPES)
  propertyType!: (typeof PROPERTY_TYPES)[number];

  @IsIn(LISTING_PURPOSES)
  listingPurpose!: (typeof LISTING_PURPOSES)[number];

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
  @Min(0)
  areaSqm?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PROPERTY_FEATURE_KEYS, { each: true })
  publicFeatureKeys?: string[];

  /** Defaults to `PRIVATE` in the service when omitted — the safest default (see docs/PERMISSIONS.md "Public location rules"). */
  @IsOptional()
  @IsIn(LOCATION_VISIBILITIES)
  locationVisibility?: (typeof LOCATION_VISIBILITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  publicCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  publicCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  publicArea?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PUBLICATION_MEDIA)
  @ValidateNested({ each: true })
  @Type(() => PublicationMediaSelectionDto)
  media?: PublicationMediaSelectionDto[];
}

export class PublicationReasonDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}
