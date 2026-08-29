import type { AccountStatus } from '../api/types';

export type RootRoute = 'loading' | 'auth' | 'verification' | 'app';

export interface ResolveRootRouteInput {
  status: 'loading' | 'signed-out' | 'signed-in';
  /** Only meaningful when `status === 'signed-in'`. */
  accountStatus?: AccountStatus | null;
}

/**
 * Pure decision extracted from `RootNavigator.tsx` (see jest.config.js —
 * specs stay `.ts`, never `.tsx`). A `PENDING_VERIFICATION` account is
 * signed in (the backend allows login before verification — see
 * docs/API.md "Registration → activation flow") but must finish email +
 * phone verification before it can reach role-aware navigation, since an
 * AGENT/COMPANY has no workspace yet until then. SUSPENDED/DEACTIVATED
 * never reach this function signed-in — the backend rejects login and
 * the JWT strategy rejects the token, so `loadSession` signs them out.
 */
export function resolveRootRoute({ status, accountStatus }: ResolveRootRouteInput): RootRoute {
  if (status === 'loading') return 'loading';
  if (status === 'signed-out') return 'auth';
  return accountStatus === 'PENDING_VERIFICATION' ? 'verification' : 'app';
}
