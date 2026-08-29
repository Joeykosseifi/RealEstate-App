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

/** Sends a password-reset email — the account-settings "security" entry point (see docs/PRODUCT.md "Account settings"). */
export function requestPasswordReset(email: string): Promise<void> {
  return apiRequest('/auth/password/forgot', { method: 'POST', body: { email }, auth: false });
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return apiRequest('/workspaces');
}

/** The one workspace endpoint that also resolves the caller's permission set — used to drive permission-gated UI (e.g. hiding "Archive" without `client.archive`). */
export function getWorkspaceDetail(workspaceId: string): Promise<WorkspaceDetail> {
  return apiRequest(`/workspaces/${workspaceId}`);
}

export interface UpdateWorkspaceContactInput {
  publicContactPhone?: string;
  publicContactEmail?: string;
  publicContactWhatsapp?: string;
}

/** An empty string clears a field; an omitted field is left unchanged. Requires `workspace.update`. */
export function updateWorkspaceContact(
  workspaceId: string,
  input: UpdateWorkspaceContactInput,
): Promise<void> {
  return apiRequest(`/workspaces/${workspaceId}/contact`, { method: 'PATCH', body: input });
}
