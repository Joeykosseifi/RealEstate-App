import { Injectable } from '@nestjs/common';
import type { Company, Prisma, Workspace } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export interface PendingCompanyProfile {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
}

const OWNER_ROLE_KEY = 'OWNER';

/**
 * Creates the workspace foundation an activated account needs. Every
 * method here assumes the caller already holds whatever concurrency
 * guard is needed for exactly-once semantics (see
 * AccountActivationService, which takes a row lock on the user before
 * calling these) — the upserts below are a second, independent layer of
 * protection against the same race, not the only one.
 */
@Injectable()
export class WorkspacesService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Idempotent: safe to call more than once for the same user. Returns
   * the user's existing personal workspace if one already exists rather
   * than creating a second (enforced by the unique constraint on
   * Workspace.personalOwnerUserId — see schema.prisma).
   */
  async ensurePersonalWorkspace(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    displayName: string,
  ): Promise<Workspace> {
    const ownerRole = await tx.role.findUnique({
      where: { key: OWNER_ROLE_KEY },
    });

    const workspace = await tx.workspace.upsert({
      where: { personalOwnerUserId: ownerUserId },
      update: {},
      create: {
        type: 'PERSONAL',
        name: displayName ? `${displayName}'s Workspace` : 'Personal Workspace',
        personalOwnerUserId: ownerUserId,
      },
    });

    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: ownerUserId },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        userId: ownerUserId,
        membershipType: 'OWNER',
        status: 'ACTIVE',
        roleId: ownerRole?.id,
        joinedAt: new Date(),
      },
    });

    await this.audit.log(
      {
        actorUserId: ownerUserId,
        action: 'workspace.personal_created',
        targetType: 'Workspace',
        targetId: workspace.id,
      },
      tx,
    );

    return workspace;
  }

  /**
   * Creates the Company, its COMPANY workspace, and the registering
   * user's OWNER membership together. NOT idempotent on its own — callers
   * must ensure this runs at most once per user (AccountActivationService
   * does this via a row lock + accountStatus check), since a Company has
   * no natural unique key to upsert against.
   */
  async createCompanyWithWorkspace(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    profile: PendingCompanyProfile,
  ): Promise<{ company: Company; workspace: Workspace }> {
    const ownerRole = await tx.role.findUnique({
      where: { key: OWNER_ROLE_KEY },
    });

    const company = await tx.company.create({
      data: {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        website: profile.website,
        description: profile.description,
        createdByUserId: ownerUserId,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        type: 'COMPANY',
        name: profile.name,
        companyId: company.id,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: ownerUserId,
        membershipType: 'OWNER',
        status: 'ACTIVE',
        roleId: ownerRole?.id,
        joinedAt: new Date(),
      },
    });

    await this.audit.log(
      {
        actorUserId: ownerUserId,
        action: 'workspace.company_created',
        targetType: 'Workspace',
        targetId: workspace.id,
        metadata: { companyId: company.id },
      },
      tx,
    );

    return { company, workspace };
  }
}
