/**
 * Grants the SUPER_ADMIN platform role to an already-registered user.
 * This is the ONLY way to create the first platform administrator — there
 * is no HTTP endpoint that can do this, by design (see docs/SECURITY.md
 * "Super Admin bootstrap").
 *
 * Usage:
 *   1. Register a normal account for the intended admin through the
 *      standard flow (POST /api/v1/auth/register/client, then verify
 *      email + phone) — this script never creates a user or sets a
 *      password; it only grants a role to an account that already went
 *      through the platform's own secure signup.
 *   2. Run, with the environment sourced (same convention as
 *      `npm run prisma:seed`):
 *        set -a; source .env; set +a
 *        SUPER_ADMIN_BOOTSTRAP_EMAIL=owner@example.com npm run admin:bootstrap
 *
 * Idempotent: running it again for a user who already holds SUPER_ADMIN
 * is a no-op. Never hard-codes a default admin or password.
 */
import { PrismaClient } from '@prisma/client';

const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rawEmail = process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL;
  if (!rawEmail) {
    throw new Error(
      'SUPER_ADMIN_BOOTSTRAP_EMAIL is not set. Example:\n' +
        '  SUPER_ADMIN_BOOTSTRAP_EMAIL=owner@example.com npm run admin:bootstrap',
    );
  }
  const email = rawEmail.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `No account found for "${email}". Register this email through the normal signup flow ` +
        '(POST /api/v1/auth/register/client or /register/agent) and verify it before bootstrapping.',
    );
  }

  const role = await prisma.role.findFirst({
    where: { key: SUPER_ADMIN_ROLE_KEY, scope: 'PLATFORM' },
  });
  if (!role) {
    throw new Error(
      'SUPER_ADMIN role is not seeded. Run `npm run prisma:seed` first.',
    );
  }

  const existingGrant = await prisma.userPlatformRole.findFirst({
    where: { userId: user.id, roleId: role.id },
  });
  if (existingGrant) {
    console.log(`User ${email} already holds SUPER_ADMIN. Nothing to do.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPlatformRole.create({
      data: { userId: user.id, roleId: role.id, grantedByUserId: null },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        action: 'admin.platform_role_assigned',
        targetType: 'User',
        targetId: user.id,
        metadata: { roleKey: SUPER_ADMIN_ROLE_KEY, method: 'bootstrap-script' },
      },
    });
  });

  console.log(`Granted SUPER_ADMIN to ${email} (user ${user.id}).`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
