import { IsString, MaxLength, MinLength } from 'class-validator';

/** Suspend/deactivate always require a reason — this is what makes the action auditable. */
export class ModerationActionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
