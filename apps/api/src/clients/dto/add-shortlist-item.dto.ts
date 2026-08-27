import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddShortlistItemDto {
  @IsUUID()
  propertyId!: string;

  /** Which requirement motivated this add — optional, metadata only (see docs/DATABASE.md "Shortlist requirement linkage"). */
  @IsOptional()
  @IsUUID()
  requirementId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
