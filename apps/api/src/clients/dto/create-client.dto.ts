import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
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

export class CreateClientDto {
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;

  @IsString()
  @Length(3, 30)
  phone!: string;

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

  /**
   * Optional at creation time — verified (same workspace, ACTIVE
   * membership) server-side exactly like the dedicated `POST
   * .../assign` endpoint, and requires `client.assign` in addition to
   * `client.create` when present (see ClientsService).
   */
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
