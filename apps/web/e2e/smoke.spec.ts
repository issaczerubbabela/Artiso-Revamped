import { test, expect } from '@playwright/test';

test('app boots and shows the Drawing Grid shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Drawing Grid/);
  await expect(page.getByRole('heading', { name: 'Drawing Grid' })).toBeVisible();
});
