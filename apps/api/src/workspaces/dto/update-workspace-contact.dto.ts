import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Updates the workspace's public-facing marketplace contact info (see
 * docs/PERMISSIONS.md "Public professional contact"). An empty string
 * clears the field (maps to `null` in the service) — omitting a field
 * entirely leaves it unchanged. Never touches `User.email`/`User.phone`
 * (private login credentials).
 */
export class UpdateWorkspaceContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  publicContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  @ValidateIf((dto: UpdateWorkspaceContactDto) => dto.publicContactEmail !== '')
  @IsEmail(undefined, {
    message: 'publicContactEmail must be a valid email or an empty string.',
  })
  publicContactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  publicContactWhatsapp?: string;
}
