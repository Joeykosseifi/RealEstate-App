import {
  Equals,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterBaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  /** International format, e.g. +15551234567 — validated/normalized by UsersService.normalizePhone. */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Equals(true, { message: 'You must accept the terms to register.' })
  acceptedTerms!: boolean;
}
