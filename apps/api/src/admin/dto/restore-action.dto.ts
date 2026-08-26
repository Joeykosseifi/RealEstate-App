import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RestoreActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
