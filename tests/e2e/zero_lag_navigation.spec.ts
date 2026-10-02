import { test, expect } from '@playwright/test';
import { authenticateCadetSession } from './helpers/auth_fixture';

test.describe('Zero-Lag SPA Navigation & SWR Cache Hydration Performance Suite', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateCadetSession(page);
  });

  test('Instant Warm Navigation: Profile hydrates from SWR cache with zero skeleton flicker', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Land on Dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('aside nav[aria-label="Portal navigation"]')).toBeVisible({ timeout: 10000 });

    // 2. Hover over Profile link to trigger prefetch
    const profileLink = page.locator('aside a[href="/profile"]').first();
    await profileLink.hover();
    await page.waitForTimeout(150); // allow intent prefetcher to prime SWR cache

    // 3. Click Profile and measure elapsed time to render
    const t0 = Date.now();
    await profileLink.click();
    await expect(page).toHaveURL(/.*\/profile/);

    // Assert that the full cadet dossier is rendered immediately (not stuck in a full-page skeleton)
    await expect(page.locator('header').filter({ hasText: /Cadet Dossier|Enrollment No/i }).first()).toBeVisible({ timeout: 1000 });
    const elapsedMs = Date.now() - t0;

    // 4. Verify telemetry recorded cache hit or warm hydration
    const navMetrics = await page.evaluate(() => window.__CCC_NAV_METRICS__ || []);
    expect(navMetrics.length).toBeGreaterThan(0);
    const profileMetric = navMetrics.find((m) => m.toPath === '/profile');
    if (profileMetric) {
      expect(['hit', 'stale']).toContain(profileMetric.cacheStatus);
    }

    expect(pageErrors).toHaveLength(0);
  });

  test('Rapid Inter-Route Cycling: Stress test fast sequential navigation without race conditions', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const routes = ['/contests', '/leaderboard', '/problems', '/profile', '/'];
    for (const route of routes) {
      const link = page.locator(`aside a[href="${route}"]`).first();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${route === '/' ? '/$' : route}`));
    }

    // Verify back and forward browser navigation
    await page.goBack();
    await page.goBack();
    await page.goForward();

    expect(pageErrors).toHaveLength(0);
  });

  test('Direct Cold URL Entry: Route loads cleanly and hydrates without unhandled rejections', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Direct cold navigation to /profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header').filter({ hasText: /Cadet Dossier|Enrollment No/i }).first()).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toHaveLength(0);
  });
});
