import { expect, test } from '@playwright/test';
import { gotoQueue, loadFixtures } from '../utils';

const fixtures = loadFixtures();

test.describe('Review decisions', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQueue(page);
  });

  test('7. approve moves a pending submission to PUBLISHED', async ({ page }) => {
    await page.goto(`/publications/${fixtures.pendingApprovePublicationId}`);
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
  });

  test('8. reject cannot be submitted with an empty reason', async ({ page }) => {
    await page.goto(`/publications/${fixtures.pendingRejectPublicationId}`);
    await page.getByRole('button', { name: 'Reject' }).click();
    const submit = page.getByRole('button', { name: 'Reject', exact: true }).last();
    await expect(submit).toBeDisabled();
    await page.getByPlaceholder('Reason (required)').fill('ab');
    await expect(submit).toBeDisabled();
  });

  test('9. reject works with a valid reason', async ({ page }) => {
    await page.goto(`/publications/${fixtures.pendingRejectPublicationId}`);
    await page.getByRole('button', { name: 'Reject' }).click();
    await page.getByPlaceholder('Reason (required)').fill('Photos are too low resolution.');
    await page.getByRole('button', { name: 'Reject', exact: true }).last().click();
    await expect(page.getByText('REJECTED', { exact: true })).toBeVisible();
    await expect(page.getByText('“Photos are too low resolution.”')).toBeVisible();
  });

  test('10. request-changes cannot be submitted with an empty reason', async ({ page }) => {
    await page.goto(`/publications/${fixtures.pendingChangesPublicationId}`);
    await page.getByRole('button', { name: 'Request Changes' }).click();
    const submit = page.getByRole('button', { name: 'Request Changes', exact: true }).last();
    await expect(submit).toBeDisabled();
  });

  test('11. request-changes works with a valid reason', async ({ page }) => {
    await page.goto(`/publications/${fixtures.pendingChangesPublicationId}`);
    await page.getByRole('button', { name: 'Request Changes' }).click();
    await page.getByPlaceholder('Reason (required)').fill('Please add a floor plan image.');
    await page.getByRole('button', { name: 'Request Changes', exact: true }).last().click();
    await expect(page.getByText('CHANGES REQUESTED', { exact: true })).toBeVisible();
  });
});
