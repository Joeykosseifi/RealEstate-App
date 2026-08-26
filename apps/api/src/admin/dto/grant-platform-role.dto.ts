import { IsIn } from 'class-validator';
import { PLATFORM_ROLES } from '../../authorization/roles.catalog';

const PLATFORM_ROLE_KEYS = PLATFORM_ROLES.map((role) => role.key);

export class GrantPlatformRoleDto {
  @IsIn(PLATFORM_ROLE_KEYS)
  roleKey!: string;
}
