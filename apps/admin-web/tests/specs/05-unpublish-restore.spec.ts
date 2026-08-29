import { expect, test } from '@playwright/test';
import { gotoQueue, loadFixtures } from '../utils';

const fixtures = loadFixtures();

test.describe('Admin unpublish / restore', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQueue(page);
  });

  test('12. admin-unpublish cannot be submitted with an empty reason', async ({ page }) => {
    await page.goto(`/publications/${fixtures.publishedForUnpublishId}`);
    await page.getByRole('button', { name: 'Unpublish' }).click();
    const submit = page.getByRole('button', { name: 'Unpublish', exact: true }).last();
    await expect(submit).toBeDisabled();
  });

  test('13. admin-unpublish works with a valid reason', async ({ page }) => {
    await page.goto(`/publications/${fixtures.publishedForUnpublishId}`);
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await page.getByPlaceholder('Reason (required)').fill('Reported as a duplicate listing.');
    await page.getByRole('button', { name: 'Unpublish', exact: true }).last().click();
    await expect(page.getByText('ADMIN UNPUBLISHED', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  });

  test('14. restore returns an admin-unpublished, still-eligible listing to PUBLISHED', async ({
    page,
  }) => {
    await page.goto(`/publications/${fixtures.adminUnpublishedForRestoreId}`);
    await expect(page.getByText('ADMIN UNPUBLISHED', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(0);
  });
});
