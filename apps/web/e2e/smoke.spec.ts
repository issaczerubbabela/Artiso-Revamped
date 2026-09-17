import { test, expect } from '@playwright/test';

test('app boots and shows the Artiso shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Artiso/);
  await expect(page.getByRole('heading', { name: 'Artiso' })).toBeVisible();
});
