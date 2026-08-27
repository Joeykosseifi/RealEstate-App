import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const STATUSES = [
  'LEAD',
  'ACTIVE',
  'QUALIFIED',
  'VIEWING',
  'NEGOTIATING',
  'WON',
  'LOST',
  'INACTIVE',
  'ARCHIVED',
] as const;

const SOURCES = [
  'REFERRAL',
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'WEBSITE',
  'PHONE',
  'WALK_IN',
  'PROPERTY_INQUIRY',
  'OTHER',
] as const;

const SORT_ORDERS = ['asc', 'desc'] as const;

export class ListClientsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  /** Matched (case-insensitively) against first/last name, phone, WhatsApp phone, and email. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(SOURCES)
  source?: (typeof SOURCES)[number];

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsUUID()
  createdByUserId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  /** Defaults to false — the everyday roster is active clients, not the archive. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean = false;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: (typeof SORT_ORDERS)[number] = 'desc';
}
