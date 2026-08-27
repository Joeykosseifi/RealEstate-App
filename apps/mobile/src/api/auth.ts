import { apiRequest } from './client';
import type { AuthTokens, AuthUser, WorkspaceDetail, WorkspaceSummary } from './types';

export function login(
  email: string,
  password: string,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password }, auth: false });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest('/auth/me');
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return apiRequest('/workspaces');
}

/** The one workspace endpoint that also resolves the caller's permission set — used to drive permission-gated UI (e.g. hiding "Archive" without `client.archive`). */
export function getWorkspaceDetail(workspaceId: string): Promise<WorkspaceDetail> {
  return apiRequest(`/workspaces/${workspaceId}`);
}
