import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RegisterBaseDto } from './register-base.dto';

export class RegisterCompanyDto extends RegisterBaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  companyEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  companyPhone?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  companyDescription?: string;
}
