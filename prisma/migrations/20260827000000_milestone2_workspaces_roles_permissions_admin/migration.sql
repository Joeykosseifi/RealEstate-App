-- CreateEnum
CREATE TYPE "AuthorizationScope" AS ENUM ('PLATFORM', 'WORKSPACE');

-- DropIndex
DROP INDEX "roles_key_key";

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "scope" "AuthorizationScope" NOT NULL;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "scope" "AuthorizationScope" NOT NULL DEFAULT 'WORKSPACE',
ADD COLUMN     "workspaceId" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedByUserId" UUID,
ADD COLUMN     "deactivationReason" TEXT,
ADD COLUMN     "restoreReason" TEXT,
ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "restoredByUserId" UUID,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedByUserId" UUID,
ADD COLUMN     "suspensionReason" TEXT;

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "invitedByUserId" UUID,
ADD COLUMN     "removedByUserId" UUID,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedByUserId" UUID;

-- CreateTable
CREATE TABLE "user_platform_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_platform_roles_userId_idx" ON "user_platform_roles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_platform_roles_userId_roleId_key" ON "user_platform_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "permissions_scope_idx" ON "permissions"("scope");

-- CreateIndex
CREATE INDEX "roles_scope_idx" ON "roles"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "roles_workspaceId_key_key" ON "roles"("workspaceId", "key");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_platform_roles" ADD CONSTRAINT "user_platform_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_platform_roles" ADD CONSTRAINT "user_platform_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense-in-depth: the composite unique index above
-- (workspaceId, key) does NOT stop two different system (NULL
-- workspaceId) roles from sharing the same key, because SQL never
-- treats NULL as equal to NULL for uniqueness purposes. System role
-- keys (WORKSPACE_OWNER, SUPER_ADMIN, etc.) must still be globally
-- unique, so add a partial unique index scoped to system rows only.
-- Custom per-workspace role keys remain free to repeat across
-- different workspaces via the composite index above.
CREATE UNIQUE INDEX "roles_system_key_unique" ON "roles"("key") WHERE "workspaceId" IS NULL;

-- Data migration: Milestone 1 seeded a single system role with key
-- "OWNER". Milestone 2's workspace role catalog names it
-- "WORKSPACE_OWNER" — rename the existing row in place (preserving its
-- id, and therefore every WorkspaceMember.roleId already pointing at
-- it) rather than creating a second row and leaving the old one
-- orphaned.
UPDATE "roles" SET "key" = 'WORKSPACE_OWNER', "name" = 'Workspace Owner', "scope" = 'WORKSPACE' WHERE "key" = 'OWNER';

