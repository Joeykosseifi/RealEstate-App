import { apiRequest } from './client';
import type { AuthTokens, AuthUser, WorkspaceSummary } from './types';

export function login(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password }, auth: false });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest('/auth/me');
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return apiRequest('/workspaces');
}
