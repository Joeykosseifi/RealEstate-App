import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}
