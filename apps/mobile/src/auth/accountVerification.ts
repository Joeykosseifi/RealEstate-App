import type { AuthUser } from '../api/types';

/**
 * Mirrors the API's canonical check (apps/api/src/auth/account-verification.ts):
 * both verification timestamps, never `accountStatus` and never the local
 * "Verify Later" flag. The backend enforces this on every workspace route;
 * the client uses it only to avoid showing screens that would be denied.
 */
export function isAccountVerified(
  user: Pick<AuthUser, 'emailVerifiedAt' | 'phoneVerifiedAt'> | null | undefined,
): boolean {
  return Boolean(user?.emailVerifiedAt) && Boolean(user?.phoneVerifiedAt);
}

/** Runs `onAllowed` for a verified account, otherwise `onBlocked` (show the verification prompt). */
export function guardVerifiedAction(
  verified: boolean,
  onAllowed: () => void,
  onBlocked: () => void,
): void {
  if (verified) {
    onAllowed();
  } else {
    onBlocked();
  }
}

export const VERIFICATION_PROMPT_TITLE = 'Verification required';
export const VERIFY_ACCOUNT_LABEL = 'Verify Account';
export const NOT_NOW_LABEL = 'Not Now';

export function verificationPromptMessage(feature = 'adding properties'): string {
  return `Please verify your account before ${feature} to ProBase.`;
}

/** Structurally compatible with React Native's `AlertButton` (kept RN-import-free so it's unit-testable). */
export interface VerificationPromptButton {
  text: string;
  style: 'cancel' | 'default';
  onPress: () => void;
}

/**
 * "Not Now" is a pure dismissal — it never navigates and never touches
 * verification state. "Verify Account" only opens the existing
 * verification screen; nothing here marks the account verified.
 */
export function buildVerificationPromptButtons({
  onVerify,
  onDismiss = () => undefined,
}: {
  onVerify: () => void;
  onDismiss?: () => void;
}): VerificationPromptButton[] {
  return [
    { text: NOT_NOW_LABEL, style: 'cancel', onPress: onDismiss },
    { text: VERIFY_ACCOUNT_LABEL, style: 'default', onPress: onVerify },
  ];
}
