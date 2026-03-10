import { expect, test } from '@playwright/test';

test('protected job detail redirects guests to login and preserves account creation intent', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'cookieConsent',
      JSON.stringify({ functional: true, analytics: false, marketing: false }),
    );
  });

  await page.route('**/api/auth/me*', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Unauthorized' }),
    });
  });

  await page.goto('/jobs/job-frontend-1');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/register\?redirect=%2Fjobs%2Fjob-frontend-1$/);
  await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible();
});
