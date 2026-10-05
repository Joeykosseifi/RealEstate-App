import type { AccountStatus } from '../api/types';

export type RootRoute = 'loading' | 'auth' | 'verification' | 'app';

export interface ResolveRootRouteInput {
  status: 'loading' | 'signed-out' | 'signed-in';
  /** Only meaningful when `status === 'signed-in'`. */
  accountStatus?: AccountStatus | null;
  /**
   * Set once the signed-in user has explicitly chosen "Verify Later" on
   * the verification screen (see AuthContext.skipVerification) — a
   * client-side-only navigation preference, never a backend field. It
   * never changes `accountStatus`/`emailVerifiedAt`/`phoneVerifiedAt`,
   * and only admits the account to the public-only experience (see
   * `roleRouting.ts`) — the API still rejects every workspace route
   * until it is really verified.
   */
  verificationSkipped?: boolean;
}

/**
 * Pure decision extracted from `RootNavigator.tsx` (see jest.config.js —
 * specs stay `.ts`, never `.tsx`). A `PENDING_VERIFICATION` account is
 * signed in (the backend allows login before verification — see
 * docs/API.md "Registration → activation flow") and, since Milestone
 * "Verify Later", may enter the app in public-only mode (marketplace
 * browsing). By default such an account is still routed to the
 * verification screen so it isn't silently skipped;
 * `verificationSkipped` is the one escape hatch, set only by the user's
 * own explicit choice.
 */
export function resolveRootRoute({
  status,
  accountStatus,
  verificationSkipped,
}: ResolveRootRouteInput): RootRoute {
  if (status === 'loading') return 'loading';
  if (status === 'signed-out') return 'auth';
  if (accountStatus === 'PENDING_VERIFICATION' && !verificationSkipped) {
    return 'verification';
  }
  return 'app';
}
