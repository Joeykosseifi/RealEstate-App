import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const LOCATION_SOURCES = [
  'GOOGLE_SEARCH',
  'MAP_PIN',
  'CURRENT_LOCATION',
  'MANUAL',
] as const;
const LOCATION_VISIBILITIES = [
  'PRIVATE',
  'WORKSPACE',
  'PUBLIC_APPROXIMATE',
  'PUBLIC_EXACT',
] as const;

/**
 * The exact Google Maps location — see docs/PERMISSIONS.md "Google Maps
 * strategy." `latitude`/`longitude` are validated to real-world ranges
 * (`class-validator`'s `@IsLatitude`/`@IsLongitude` enforce -90..90 /
 * -180..180); the database value is the permanent source of truth once
 * saved, `googlePlaceId` is a convenience reference only.
 */
export class PropertyLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId?: string;

  @IsOptional()
  @IsIn(LOCATION_SOURCES)
  locationSource?: (typeof LOCATION_SOURCES)[number];

  @IsOptional()
  @IsIn(LOCATION_VISIBILITIES)
  locationVisibility?: (typeof LOCATION_VISIBILITIES)[number];
}
