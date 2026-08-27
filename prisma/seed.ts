/**
 * Development/foundation seed data only — never seed fake production
 * users here. Seeds the full permission catalog and the system
 * workspace/platform roles (with their role-permission mappings) from
 * apps/api/src/authorization/{permissions,roles}.catalog.ts — the single
 * source of truth for both, so this script and the running API can never
 * drift apart. See docs/PERMISSIONS.md.
 */
import { PrismaClient, type AuthorizationScope } from '@prisma/client';
import { PERMISSION_CATALOG } from '../apps/api/src/authorization/permissions.catalog';
import { SYSTEM_ROLES } from '../apps/api/src/authorization/roles.catalog';

const prisma = new PrismaClient();

async function seedPermissions(): Promise<void> {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        description: permission.description,
        scope: permission.scope as AuthorizationScope,
      },
      create: {
        key: permission.key,
        description: permission.description,
        scope: permission.scope as AuthorizationScope,
      },
    });
  }
  console.log(`Seeded ${PERMISSION_CATALOG.length} permission(s).`);
}

async function seedSystemRoles(): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    // Prisma's compound-unique selector (workspaceId_key) rejects an
    // explicit `null` for the nullable half, even though the column
    // itself is nullable — so upsert-by-composite-key doesn't work here.
    // findFirst + manual create/update does.
    const existing = await prisma.role.findFirst({
      where: { workspaceId: null, key: role.key },
    });

    const roleData = {
      name: role.name,
      description: role.description,
      scope: role.scope as AuthorizationScope,
      isSystem: true,
    };

    const savedRole = existing
      ? await prisma.role.update({ where: { id: existing.id }, data: roleData })
      : await prisma.role.create({ data: { key: role.key, ...roleData } });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: role.permissions } },
    });

    // Defense-in-depth: mirrors the runtime check in RolesService. A
    // catalog bug that lists a mismatched-scope permission for a role
    // must fail the seed loudly, not silently grant it.
    const mismatched = permissions.filter((permission) => permission.scope !== savedRole.scope);
    if (mismatched.length > 0) {
      throw new Error(
        `Role "${role.key}" (${savedRole.scope}) cannot be granted permission(s) of a ` +
          `different scope: ${mismatched.map((p) => p.key).join(', ')}`,
      );
    }
    if (permissions.length !== role.permissions.length) {
      const found = new Set(permissions.map((p) => p.key));
      const missing = role.permissions.filter((key) => !found.has(key));
      throw new Error(`Role "${role.key}" references unknown permission(s): ${missing.join(', ')}`);
    }

    // Small, fully-owned-by-this-seed catalog — replace mappings
    // wholesale rather than diffing, so removing a permission from a
    // role's catalog entry actually takes effect on re-seed.
    await prisma.rolePermission.deleteMany({ where: { roleId: savedRole.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: savedRole.id,
        permissionId: permission.id,
      })),
    });
  }
  console.log(`Seeded ${SYSTEM_ROLES.length} system role(s) with role-permission mappings.`);
}

async function main(): Promise<void> {
  await seedPermissions();
  await seedSystemRoles();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
