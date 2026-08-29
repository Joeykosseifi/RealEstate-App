import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

export interface Fixtures {
  adminEmail: string;
  adminPassword: string;
  pendingApprovePublicationId: string;
  pendingRejectPublicationId: string;
  pendingChangesPublicationId: string;
  pendingLeakPublicationId: string;
  ownerSecretMarker: string;
  publishedForUnpublishId: string;
  adminUnpublishedForRestoreId: string;
}

export function loadFixtures(): Fixtures {
  const path = join(process.cwd(), 'tests', '.fixtures.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Fixtures;
}

/** Logs in through the real login form (scenario 1 only) and lands on the queue. */
export async function loginAsAdmin(page: Page, fixtures: Fixtures): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(fixtures.adminEmail);
  await page.getByPlaceholder('Password').fill(fixtures.adminPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/publications');
}

/**
 * Every other spec starts from the pre-authenticated storage state
 * (see playwright.config.ts) rather than re-submitting the real login
 * form per test — the login endpoint is really rate-limited, exactly
 * like production, and a fresh login per test would exhaust that
 * budget. This just navigates straight to the already-authenticated queue.
 */
export async function gotoQueue(page: Page): Promise<void> {
  await page.goto('/publications');
  await page.waitForURL('**/publications');
}
