import { expect, test } from '@playwright/test';
import { gotoQueue } from '../utils';

test.describe('Publication review queue', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQueue(page);
  });

  test('2. the queue renders pending submissions in a table', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(page.getByRole('link', { name: 'Approve Me Apartment' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reject Me Apartment' })).toBeVisible();
  });

  test('3. switching the status filter reloads the queue for that status', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Approve Me Apartment' })).toBeVisible();

    await page.getByRole('button', { name: 'PUBLISHED', exact: true }).click();
    // Pending-only fixtures must disappear once filtered to PUBLISHED.
    await expect(page.getByRole('link', { name: 'Approve Me Apartment' })).toHaveCount(0);

    await page.getByRole('button', { name: 'PENDING REVIEW' }).click();
    await expect(page.getByRole('link', { name: 'Approve Me Apartment' })).toBeVisible();
  });

  test('4. pagination advances through more than one page and back', async ({ page }) => {
    await expect(page.getByText(/Page 1 of/)).toBeVisible();
    const pageIndicator = page.getByText(/Page \d+ of \d+/);
    const before = await pageIndicator.textContent();
    expect(before).toMatch(/Page 1 of [2-9]/);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(pageIndicator).toHaveText(/Page 2 of/);

    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(pageIndicator).toHaveText(/Page 1 of/);
  });
});
