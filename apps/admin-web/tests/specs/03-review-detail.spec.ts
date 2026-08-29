import { expect, test } from '@playwright/test';
import { gotoQueue, loadFixtures } from '../utils';

const fixtures = loadFixtures();

test.describe('Publication review detail', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQueue(page);
  });

  test('5. opening a queue row navigates to its review detail', async ({ page }) => {
    await page.getByRole('link', { name: 'Approve Me Apartment' }).click();
    await page.waitForURL(`**/publications/${fixtures.pendingApprovePublicationId}`);
    await expect(page.getByRole('heading', { name: 'Approve Me Apartment' })).toBeVisible();
  });

  test('6. the review detail renders the public-safe snapshot without error', async ({ page }) => {
    await page.goto(`/publications/${fixtures.pendingApprovePublicationId}`);
    await expect(page.getByRole('heading', { name: 'Approve Me Apartment' })).toBeVisible();
    await expect(page.getByText('USD 200,000')).toBeVisible();
    await expect(page.getByText('APARTMENT · SALE')).toBeVisible();
    await expect(page.getByText('PENDING REVIEW', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  });

  test('16. private professional/owner fields are never rendered in the moderation snapshot', async ({
    page,
  }) => {
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes(`/admin/property-publications/${fixtures.pendingLeakPublicationId}`),
    );
    await page.goto(`/publications/${fixtures.pendingLeakPublicationId}`);
    const response = await responsePromise;
    const bodyText = await response.text();

    expect(bodyText).not.toContain(fixtures.ownerSecretMarker);
    expect(bodyText).not.toContain('+96170000999');
    expect(bodyText).not.toContain('owner-secret@example.test');

    const pageContent = await page.content();
    expect(pageContent).not.toContain(fixtures.ownerSecretMarker);
    expect(pageContent).not.toContain('+96170000999');
  });
});
