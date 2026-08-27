import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { PresentationItemInputDto } from './create-presentation.dto';

/**
 * Whole-list replace semantics for `items` when present — same
 * convention as `UpdatePropertyDto`'s nested sections. Editing a
 * `GENERATED` presentation's title/items/notes moves it back to
 * `DRAFT` (see PresentationsService) without touching the still-valid,
 * previously generated PDF until an explicit `POST .../generate`.
 */
export class UpdatePresentationDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  requirementId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PresentationItemInputDto)
  items?: PresentationItemInputDto[];
}
