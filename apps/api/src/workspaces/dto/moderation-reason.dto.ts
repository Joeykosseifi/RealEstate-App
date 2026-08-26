import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Used for workspace-level member suspend/remove — a reason is encouraged but not required. */
export class ModerationReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
