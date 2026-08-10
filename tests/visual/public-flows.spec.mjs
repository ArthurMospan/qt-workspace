import { test, expect } from '@playwright/test';

const DEV_SERVER_NOISE = /webpack-hmr|WebSocket connection to 'ws:/;

async function preparePage(page) {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error' && !DEV_SERVER_NOISE.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  await page.route('https://buggy-bag.vercel.app/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '',
  }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }));
  return errors;
}

async function expectHealthyPage(page, errors, ignored = []) {
  await expect(page.locator('body')).not.toHaveText('');
  await expect(page.locator('[data-nextjs-dialog], #webpack-dev-server-client-overlay')).toHaveCount(0);
  expect(errors.filter(error => !ignored.some(pattern => pattern.test(error)))).toEqual([]);
}

test('public routes, redirects and security headers form one coherent entry flow', async ({ page }) => {
  const errors = await preparePage(page);

  const loginResponse = await page.goto('/login', { waitUntil: 'domcontentloaded' });
  expect(loginResponse?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Увійти або зареєструватися' })).toBeVisible();
  expect(loginResponse?.headers()['x-content-type-options']).toBe('nosniff');
  expect(loginResponse?.headers()['x-frame-options']).toBe('SAMEORIGIN');

  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login\?next=%2F$/);

  const privacyResponse = await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  expect(privacyResponse?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Політика');

  // Three segments cannot be mistaken for the top-level `[projectId]` route,
  // so this verifies the routing-level hard 404 rather than an authenticated
  // project lookup.
  const missingResponse = await page.goto('/route/does/not/exist', { waitUntil: 'domcontentloaded' });
  expect(missingResponse?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Сторінку не знайдено' })).toBeVisible();
  await expectHealthyPage(page, errors, [/server responded with a status of 404/]);
});

test('the public entry flow fits a phone viewport without horizontal overflow', async ({ page }) => {
  const errors = await preparePage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Увійти або зареєструватися' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expectHealthyPage(page, errors);
});

test('a custom sheet traps focus, closes on Escape and restores its opener', async ({ page }) => {
  const errors = await preparePage(page);
  await page.goto('/ui-kit', { waitUntil: 'domcontentloaded' });
  const scroller = page.locator('[data-kit-scroll]');
  await scroller.waitFor();
  await page.locator('[data-kit-nav="buttons"]').click();
  await expect(scroller).toHaveAttribute('data-kit-section', 'buttons');

  const opener = page.locator('button[title^="Button:"]').first();
  await opener.click();
  const dialog = page.getByRole('dialog', { name: /Де використовується/ });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  const controls = dialog.locator('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
  const first = controls.first();
  const last = controls.last();
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  await expectHealthyPage(page, errors);
});
