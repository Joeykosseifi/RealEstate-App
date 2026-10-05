import type { ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  AccountVerificationRequiredException,
  isAccountVerified,
} from '../account-verification';
import { VerifiedAccountGuard } from './verified-account.guard';

function contextFor(user: Partial<User> | undefined): ExecutionContext {
  const request = user ? { user: { userId: 'u1', sessionId: 's1', user } } : {};
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const now = new Date();

describe('isAccountVerified', () => {
  it('requires BOTH email and phone verification timestamps', () => {
    expect(
      isAccountVerified({ emailVerifiedAt: now, phoneVerifiedAt: now }),
    ).toBe(true);
    expect(
      isAccountVerified({ emailVerifiedAt: now, phoneVerifiedAt: null }),
    ).toBe(false);
    expect(
      isAccountVerified({ emailVerifiedAt: null, phoneVerifiedAt: now }),
    ).toBe(false);
    expect(
      isAccountVerified({ emailVerifiedAt: null, phoneVerifiedAt: null }),
    ).toBe(false);
  });
});

describe('VerifiedAccountGuard', () => {
  const guard = new VerifiedAccountGuard();

  it('allows a fully verified account', () => {
    expect(
      guard.canActivate(
        contextFor({ emailVerifiedAt: now, phoneVerifiedAt: now }),
      ),
    ).toBe(true);
  });

  it('rejects an unverified account with AccountVerificationRequiredException (403)', () => {
    expect(() =>
      guard.canActivate(
        contextFor({ emailVerifiedAt: null, phoneVerifiedAt: null }),
      ),
    ).toThrow(AccountVerificationRequiredException);
  });

  it('rejects an ACTIVE account that is not actually verified (e.g. restored by an admin) — accountStatus is not the source of truth', () => {
    expect(() =>
      guard.canActivate(
        contextFor({
          accountStatus: 'ACTIVE',
          emailVerifiedAt: now,
          phoneVerifiedAt: null,
        }),
      ),
    ).toThrow(AccountVerificationRequiredException);
  });

  it('rejects a request with no authenticated user (fails closed)', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      AccountVerificationRequiredException,
    );
  });

  it('exposes a stable, machine-readable error name and a 403 status', () => {
    const error = new AccountVerificationRequiredException();
    expect(error.getStatus()).toBe(403);
    expect(error.name).toBe('AccountVerificationRequiredException');
  });
});
