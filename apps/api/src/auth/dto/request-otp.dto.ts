import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;
}
