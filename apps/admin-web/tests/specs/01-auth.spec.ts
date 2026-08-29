import { expect, test } from '@playwright/test';
import { loadFixtures, loginAsAdmin } from '../utils';

const fixtures = loadFixtures();

// This file specifically tests the real login form and an unauthenticated
// session, so it must NOT start from the pre-authenticated storage state
// every other spec file uses (see playwright.config.ts / global-setup.ts).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Admin authentication', () => {
  test('1. admin can log in and lands on the review queue', async ({ page }) => {
    await loginAsAdmin(page, fixtures);
    await expect(page.getByRole('heading', { name: 'Publication Review Queue' })).toBeVisible();
    await expect(page.getByText(fixtures.adminEmail)).toBeVisible();
  });

  test('15. an unauthenticated/expired session is redirected to login, never shown queue data', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      window.localStorage.setItem('realestate.admin.accessToken', 'not-a-real-token');
    });
    await page.goto('/publications');
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
  });
});
