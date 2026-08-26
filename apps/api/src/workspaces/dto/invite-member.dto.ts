import { IsEmail, IsIn, IsOptional, IsUUID, MaxLength } from 'class-validator';

const INVITABLE_MEMBERSHIP_TYPES = [
  'EMPLOYEE',
  'FREELANCE_AGENT',
  'COLLABORATOR',
] as const;

export class InviteMemberDto {
  /** Must be an already-registered account — inviting a not-yet-registered email is Milestone 8. */
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsIn(INVITABLE_MEMBERSHIP_TYPES)
  membershipType!: (typeof INVITABLE_MEMBERSHIP_TYPES)[number];

  @IsOptional()
  @IsUUID()
  roleId?: string;
}
