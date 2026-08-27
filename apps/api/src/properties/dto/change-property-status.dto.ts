import { IsIn } from 'class-validator';

/**
 * ARCHIVED is deliberately excluded here — reaching ARCHIVED always goes
 * through `POST .../archive` (which also stamps archivedAt/archivedByUserId
 * and enforces the archive permission specifically), never this generic
 * status endpoint. See PropertiesService.changeStatus for the allowed
 * transition table.
 */
const ASSIGNABLE_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'SOLD',
  'RENTED',
  'OFF_MARKET',
] as const;

export class ChangePropertyStatusDto {
  @IsIn(ASSIGNABLE_STATUSES)
  propertyStatus!: (typeof ASSIGNABLE_STATUSES)[number];
}
