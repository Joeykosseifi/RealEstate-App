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

// ---------------------------------------------------------------------------
// Registration & onboarding (Milestone 6.1) — see docs/API.md
// "Registration → activation flow". Registration never returns tokens;
// the caller logs in separately once verification completes.
// ---------------------------------------------------------------------------

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  acceptedTerms: boolean;
}

export interface RegisterCompanyInput extends RegisterInput {
  companyName: string;
}

export function registerClient(input: RegisterInput): Promise<AuthUser> {
  return apiRequest('/auth/register/client', { method: 'POST', body: input, auth: false });
}

export function registerAgent(input: RegisterInput): Promise<AuthUser> {
  return apiRequest('/auth/register/agent', { method: 'POST', body: input, auth: false });
}

export function registerCompany(input: RegisterCompanyInput): Promise<AuthUser> {
  return apiRequest('/auth/register/company', { method: 'POST', body: input, auth: false });
}

export function verifyEmail(token: string): Promise<void> {
  return apiRequest('/auth/email/verify', { method: 'POST', body: { token }, auth: false });
}

/** Always resolves — the backend never reveals whether the email is registered or already verified. */
export function resendEmailVerification(email: string): Promise<void> {
  return apiRequest('/auth/email/resend', { method: 'POST', body: { email }, auth: false });
}

/** Always resolves — the backend never reveals whether the phone is registered or already verified. */
export function requestPhoneOtp(phone: string): Promise<void> {
  return apiRequest('/auth/phone/request-otp', { method: 'POST', body: { phone }, auth: false });
}

export function verifyPhoneOtp(phone: string, otp: string): Promise<void> {
  return apiRequest('/auth/phone/verify', { method: 'POST', body: { phone, otp }, auth: false });
}

/** Sends a password-reset email — the account-settings "security" entry point (see docs/PRODUCT.md "Account settings"). */
export function requestPasswordReset(email: string): Promise<void> {
  return apiRequest('/auth/password/forgot', { method: 'POST', body: { email }, auth: false });
}

/** Completes a password reset with the token emailed by `requestPasswordReset`. Revokes every existing session for the account. */
export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiRequest('/auth/password/reset', {
    method: 'POST',
    body: { token, newPassword },
    auth: false,
  });
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
