import { IsUUID, ValidateIf } from 'class-validator';

/**
 * `assignedToUserId: null` explicitly unassigns — `ValidateIf` lets
 * `null` through unchanged while still requiring a real UUID whenever a
 * value is provided. The target is re-verified (same workspace, ACTIVE
 * membership) server-side in ClientsService; nothing here is trusted
 * beyond "this is a UUID."
 */
export class AssignClientDto {
  @ValidateIf((dto: AssignClientDto) => dto.assignedToUserId !== null)
  @IsUUID()
  assignedToUserId!: string | null;
}
