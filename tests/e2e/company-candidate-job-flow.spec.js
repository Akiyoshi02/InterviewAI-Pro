import { test, expect } from '@playwright/test';

test('protected job detail route redirects guests to login and preserves account creation path', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Unauthorized' }),
    });
  });

  await page.goto('/jobs/job-frontend-1');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/register(\?|$)/);
  await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible();
});
