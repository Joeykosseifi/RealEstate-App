import * as SecureStore from 'expo-secure-store';

/**
 * "Verify Later" is a client-side-only navigation preference — it is
 * never sent to the backend and never changes `accountStatus`/
 * `emailVerifiedAt`/`phoneVerifiedAt` (see AuthContext.skipVerification
 * and resolveRootRoute.ts). Keyed per user id so switching accounts on
 * the same device never leaks one user's choice to another.
 */
function storageKey(userId: string): string {
  return `realestate.verificationSkipped.${userId}`;
}

export async function hasSkippedVerification(userId: string): Promise<boolean> {
  const value = await SecureStore.getItemAsync(storageKey(userId));
  return value === 'true';
}

export async function markVerificationSkipped(userId: string): Promise<void> {
  await SecureStore.setItemAsync(storageKey(userId), 'true');
}

/** Called once an account finishes verification, so a stale flag doesn't linger forever. */
export async function clearVerificationSkipped(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(userId));
}
