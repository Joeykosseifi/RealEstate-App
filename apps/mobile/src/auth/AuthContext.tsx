import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  getCurrentUser,
  getWorkspaceDetail,
  listWorkspaces,
  login as loginRequest,
} from '../api/auth';
import { clearTokens, getStoredAccessToken, storeTokens } from '../api/client';
import type { AuthUser, WorkspaceSummary } from '../api/types';

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: AuthUser | null;
  workspaces: WorkspaceSummary[];
  /** The workspace the Properties/Clients screens act in — the agent's own personal workspace, or the first company workspace they belong to. */
  currentWorkspace: WorkspaceSummary | null;
  /** The caller's resolved permission set for `currentWorkspace` — drives permission-gated UI (e.g. hiding "Archive" without `client.archive`). Empty until resolved. */
  permissions: Set<string>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectWorkspace: (workspace: WorkspaceSummary) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceSummary | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

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
      setStatus('signed-in');
    } catch {
      // Expired/invalid token — see docs/API.md "Mobile session handling":
      // this milestone doesn't implement refresh-token rotation on the
      // client, so a stale token just signs the user back out.
      await clearTokens();
      setStatus('signed-out');
    }
  }, []);

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

  const login = useCallback(async (email: string, password: string) => {
    const { tokens } = await loginRequest(email, password);
    await storeTokens(tokens.accessToken, tokens.refreshToken);
    const [me, myWorkspaces] = await Promise.all([getCurrentUser(), listWorkspaces()]);
    setUser(me);
    setWorkspaces(myWorkspaces);
    setCurrentWorkspace(myWorkspaces[0] ?? null);
    setStatus('signed-in');
  }, []);

  const logout = useCallback(async () => {
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
    }),
    [status, user, workspaces, currentWorkspace, permissions, login, logout],
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
