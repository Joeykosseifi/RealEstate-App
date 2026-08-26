import { IsEmail, MaxLength } from 'class-validator';

export class ResendEmailVerificationDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
