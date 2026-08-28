'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, clearToken, getStoredToken, storeToken } from './api';
import type { AdminUser } from './types';

interface LoginResponse {
  user: AdminUser;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Deliberately minimal — this is an internal admin tool, not a
 * consumer-facing auth flow. The access token is stored in
 * `localStorage` and attached to every request; platform authorization
 * (does this admin actually hold `admin.content.*`) is re-checked
 * server-side on every call, never assumed client-side. See
 * docs/PERMISSIONS.md "Admin authorization is never workspace
 * membership."
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      // Session-restore-on-mount: no token means nothing to load — this
      // is the standard "fetch on mount" idiom the React Compiler's
      // stricter `set-state-in-effect` rule doesn't yet have a
      // false-positive-free pattern for; see React's own "You Might Not
      // Need An Effect" guide, which still lists data fetching as a
      // valid effect use case.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    apiRequest<AdminUser>('/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    storeToken(response.tokens.accessToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
