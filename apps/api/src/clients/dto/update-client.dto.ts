import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

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

const CONTACT_METHODS = ['PHONE', 'WHATSAPP', 'EMAIL', 'OTHER'] as const;

const STATUSES = [
  'LEAD',
  'ACTIVE',
  'QUALIFIED',
  'VIEWING',
  'NEGOTIATING',
  'WON',
  'LOST',
  'INACTIVE',
] as const;

/**
 * `workspaceId`/`createdByUserId` are structurally unreachable here (no
 * fields for them), so nothing in this DTO can move a client between
 * workspaces or rewrite its authorship. Assignment is deliberately NOT
 * here either — see `AssignClientDto` / `POST .../assign`, which
 * requires `client.assign` on top of `client.edit`. `ARCHIVED` is not a
 * settable status here — only `POST .../archive` reaches it.
 */
export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  whatsappPhone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(CONTACT_METHODS)
  preferredContactMethod?: (typeof CONTACT_METHODS)[number];

  @IsOptional()
  @IsIn(SOURCES)
  source?: (typeof SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
