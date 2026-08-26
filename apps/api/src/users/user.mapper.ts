import type { User } from '@prisma/client';
import type { AuthUser } from '@real-estate/types';

/** Maps a Prisma User row to the safe public shape — never include passwordHash or pendingCompanyProfile. */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    accountType: user.accountType,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
