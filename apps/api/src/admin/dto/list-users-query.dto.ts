import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const ACCOUNT_TYPES = ['CLIENT', 'AGENT', 'COMPANY'] as const;
const ACCOUNT_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
] as const;
const VERIFICATION_FILTERS = ['verified', 'unverified'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

export class ListUsersQueryDto {
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

  /** Matched (case-insensitively) against first name, last name, and email. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  accountType?: (typeof ACCOUNT_TYPES)[number];

  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  accountStatus?: (typeof ACCOUNT_STATUSES)[number];

  @IsOptional()
  @IsIn(VERIFICATION_FILTERS)
  verification?: (typeof VERIFICATION_FILTERS)[number];

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: (typeof SORT_ORDERS)[number] = 'desc';
}
