/**
 * Development/foundation seed data only — never seed fake production
 * users here. Currently seeds the system roles Milestone 1 needs to
 * assign on workspace creation. Permissions/RolePermission are
 * populated starting Milestone 2 (see docs/PERMISSIONS.md).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  { key: 'OWNER', name: 'Owner', description: 'Workspace owner (personal or company).' },
] as const;

async function main(): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: true },
      create: { ...role, isSystem: true },
    });
  }
  console.log(`Seeded ${SYSTEM_ROLES.length} system role(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
