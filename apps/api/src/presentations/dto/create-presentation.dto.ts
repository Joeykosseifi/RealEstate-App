import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Max 50 items per presentation — a sane bound that also keeps
 * generated PDFs from growing unreasonably large (see docs/API.md
 * "Presentation PDF generation").
 */
const MAX_PRESENTATION_ITEMS = 50;

export class PresentationItemInputDto {
  @IsUUID()
  propertyId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  agentNote?: string;
}

export class CreatePresentationDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  requirementId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PRESENTATION_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PresentationItemInputDto)
  items!: PresentationItemInputDto[];
}
