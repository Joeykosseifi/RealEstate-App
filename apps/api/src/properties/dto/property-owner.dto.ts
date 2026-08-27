import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** Private professional data — see docs/PERMISSIONS.md "Sensitive property fields." */
export class PropertyOwnerDto {
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
