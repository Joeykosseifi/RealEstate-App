import { IsUUID } from 'class-validator';

export class ChangeMemberRoleDto {
  @IsUUID()
  roleId!: string;
}
