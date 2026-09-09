import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  getCurrentUser,
  getWorkspaceDetail,
  listWorkspaces,
  login as loginRequest,
  logout as logoutRequest,
} from '../api/auth';
import { clearTokens, getStoredAccessToken, storeTokens } from '../api/client';
import type { AuthUser, WorkspaceSummary } from '../api/types';
import {
  clearVerificationSkipped,
  hasSkippedVerification,
  markVerificationSkipped,
} from './verificationSkip';

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: AuthUser | null;
  workspaces: WorkspaceSummary[];
  /** The workspace the Properties/Clients screens act in — the agent's own personal workspace, or the first company workspace they belong to. */
  currentWorkspace: WorkspaceSummary | null;
  /** The caller's resolved permission set for `currentWorkspace` — drives permission-gated UI (e.g. hiding "Archive" without `client.archive`). Empty until resolved. */
  permissions: Set<string>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  selectWorkspace: (workspace: WorkspaceSummary) => void;
  /**
   * Re-fetches the current user + workspace list without a fresh login —
   * used once email + phone verification complete for an already-signed-in
   * `PENDING_VERIFICATION` account (see `screens/auth/VerificationScreen`),
   * so the newly-activated AGENT/COMPANY workspace and `accountStatus`
   * become visible without asking the user to sign in again.
   */
  refreshSession: () => Promise<void>;
  /**
   * True once this signed-in user has explicitly chosen "Verify Later".
   * Client-side-only (see `verificationSkip.ts`) — never changes
   * `accountStatus`/`emailVerifiedAt`/`phoneVerifiedAt` on the backend,
   * and never implies a feature that genuinely requires a verified
   * identity (see PublicationsService.submit) is unlocked.
   */
  verificationSkipped: boolean;
  /** Records the user's "Verify Later" choice locally so `resolveRootRoute` lets them into the app. */
  skipVerification: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceSummary | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [verificationSkipped, setVerificationSkipped] = useState(false);

  /** Reads this user's stored "Verify Later" choice and clears it once the account is fully ACTIVE (no reason to keep it around). */
  const syncVerificationSkipped = useCallback(async (me: AuthUser) => {
    if (me.accountStatus === 'ACTIVE') {
      await clearVerificationSkipped(me.id);
      setVerificationSkipped(false);
      return;
    }
    setVerificationSkipped(await hasSkippedVerification(me.id));
  }, []);

  const loadSession = useCallback(async () => {
    const token = await getStoredAccessToken();
    if (!token) {
      setStatus('signed-out');
      return;
    }
    try {
      const [me, myWorkspaces] = await Promise.all([getCurrentUser(), listWorkspaces()]);
      setUser(me);
      setWorkspaces(myWorkspaces);
      setCurrentWorkspace(myWorkspaces[0] ?? null);
      await syncVerificationSkipped(me);
      setStatus('signed-in');
    } catch {
      // Expired/invalid token — see docs/API.md "Mobile session handling":
      // this milestone doesn't implement refresh-token rotation on the
      // client, so a stale token just signs the user back out.
      await clearTokens();
      setStatus('signed-out');
    }
  }, [syncVerificationSkipped]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // Re-resolves permissions whenever the acting workspace changes —
  // never trusted from `roleKey` alone client-side, mirroring the
  // backend's own permission-Set-based authorization model.
  useEffect(() => {
    if (!currentWorkspace) {
      setPermissions(new Set());
      return;
    }
    let cancelled = false;
    getWorkspaceDetail(currentWorkspace.id)
      .then((detail) => {
        if (!cancelled) {
          setPermissions(new Set(detail.permissions));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissions(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const { tokens } = await loginRequest(email, password);
      await storeTokens(tokens.accessToken, tokens.refreshToken);
      const [me, myWorkspaces] = await Promise.all([getCurrentUser(), listWorkspaces()]);
      setUser(me);
      setWorkspaces(myWorkspaces);
      setCurrentWorkspace(myWorkspaces[0] ?? null);
      await syncVerificationSkipped(me);
      setStatus('signed-in');
      return me;
    },
    [syncVerificationSkipped],
  );

  const skipVerification = useCallback(async (userId: string) => {
    await markVerificationSkipped(userId);
    setVerificationSkipped(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Revoke the session on the server first — a best-effort call:
      // being offline, or the session already being gone, must never
      // block signing out locally.
      await logoutRequest();
    } catch {
      // Ignored — see comment above.
    }
    await clearTokens();
    setUser(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
    setPermissions(new Set());
    setStatus('signed-out');
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      workspaces,
      currentWorkspace,
      permissions,
      login,
      logout,
      selectWorkspace: setCurrentWorkspace,
      refreshSession: loadSession,
      verificationSkipped,
      skipVerification,
    }),
    [
      status,
      user,
      workspaces,
      currentWorkspace,
      permissions,
      login,
      logout,
      loadSession,
      verificationSkipped,
      skipVerification,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
