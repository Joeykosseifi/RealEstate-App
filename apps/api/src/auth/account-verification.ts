import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';

/**
 * The single canonical definition of a "verified" account. Deliberately
 * the two verification timestamps rather than `accountStatus === 'ACTIVE'`:
 * an admin restoring a suspended account sets ACTIVE without regard to
 * verification (see AdminUsersService.restore), so ACTIVE alone does not
 * prove the email/phone were ever confirmed.
 */
export function isAccountVerified(
  user: Pick<User, 'emailVerifiedAt' | 'phoneVerifiedAt'>,
): boolean {
  return user.emailVerifiedAt !== null && user.phoneVerifiedAt !== null;
}

/** Surfaces as `error: "AccountVerificationRequiredException"` in the API error body, so clients can branch on it. */
export class AccountVerificationRequiredException extends ForbiddenException {
  constructor() {
    super(
      'Verify your email and phone number to access workspace features. Until then, only the public marketplace is available.',
    );
  }
}
