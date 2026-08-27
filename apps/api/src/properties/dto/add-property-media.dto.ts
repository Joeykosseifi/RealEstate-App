import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

const MEDIA_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT'] as const;

/** Accompanies the multipart file upload — see PropertyMediaController.upload. */
export class AddPropertyMediaDto {
  @IsIn(MEDIA_TYPES)
  mediaType!: (typeof MEDIA_TYPES)[number];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
