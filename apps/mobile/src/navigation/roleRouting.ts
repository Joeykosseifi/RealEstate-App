import type { AccountType } from '../api/types';

export type MainTabsKind = 'client' | 'professional' | 'publicOnly';

/**
 * Pure decision extracted from `MainTabs.tsx` so it's unit-testable
 * without rendering (see jest.config.js — specs stay `.ts`, never
 * `.tsx`). `accountType` (the registration-path signal), never
 * workspace presence, is authoritative — see docs/PRODUCT.md
 * "Role-aware navigation".
 *
 * An unverified AGENT/COMPANY gets `publicOnly` (marketplace browsing
 * only): the API rejects every workspace route until both email and
 * phone are verified, so the CRM tabs would only ever show errors. A
 * CLIENT's tabs are already marketplace-only, verified or not.
 */
export function resolveMainTabsKind(
  accountType: AccountType | undefined,
  verified: boolean,
): MainTabsKind {
  if (accountType === 'CLIENT') return 'client';
  return verified ? 'professional' : 'publicOnly';
}
