import type { AccountType } from '../api/types';

export type MainTabsKind = 'client' | 'professional';

/**
 * Pure decision extracted from `MainTabs.tsx` so it's unit-testable
 * without rendering (see jest.config.js — specs stay `.ts`, never
 * `.tsx`). `accountType` (the registration-path signal), never
 * workspace presence, is authoritative — see docs/PRODUCT.md
 * "Role-aware navigation".
 */
export function resolveMainTabsKind(accountType: AccountType | undefined): MainTabsKind {
  return accountType === 'CLIENT' ? 'client' : 'professional';
}
