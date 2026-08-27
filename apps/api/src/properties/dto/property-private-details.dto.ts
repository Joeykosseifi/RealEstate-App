import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Internal professional data. `internalNotes`/`acquisitionSource`/
 * `internalReference`/`privateStatusNotes` require
 * `property.view_private_notes`; `commissionNotes` additionally
 * requires `property.view_commission` — see
 * PropertiesService.assertCanWriteSensitiveSections.
 */
export class PropertyPrivateDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commissionNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  acquisitionSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  internalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privateStatusNotes?: string;
}
