import { expect, test } from '@playwright/test';

test('candidate register and protected jobs entry points behave correctly for guests', async ({ page }) => {
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

  await page.goto('/register?ref=REFSMOKE01');
  await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible();
  await expect(page.getByPlaceholder('Enter your email address')).toBeVisible();
  await expect(page).toHaveURL(/\/register\?ref=REFSMOKE01$/);

  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
});
