import { test, expect } from '@playwright/test';
import { DeadUIDetector } from './helpers/dead_ui_detector';
import { authenticateCadetSession } from './helpers/auth_fixture';

test.describe('Dead-UI & Interactive Element Heuristic Audit', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateCadetSession(page);
  });

  test('Home Page: Verify all primary navigation and action buttons are responsive', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const detector = new DeadUIDetector(page);

    // Identify interactive buttons on the home landing
    const buttons = page.locator('nav a, header button, main a, main button').filter({
      hasNotText: 'Logout',
    });

    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    const auditedIndices = Math.min(count, 8); // Sample up to 8 representative elements
    for (let i = 0; i < auditedIndices; i++) {
      const btn = buttons.nth(i);
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;

      const evalResult = await detector.evaluateElement(btn);

      // Verify the element is not definitely broken
      expect(
        evalResult.classification,
        `Element at index ${i} was classified as ${evalResult.classification}: ${evalResult.reason}`
      ).not.toBe('DEFINITELY_BROKEN');
    }
  });

  test('Contests Hub: Verify contest cards, filter tabs, and registration triggers are functional', async ({ page }) => {
    await page.goto('/contests', { waitUntil: 'domcontentloaded' });
    const detector = new DeadUIDetector(page);

    // Wait for contest hub container to mount
    await expect(page.locator('h1, [data-testid="contests-hub"], main').first()).toBeVisible({ timeout: 10000 });

    // Test filter buttons (e.g. All, Official, Past)
    const filterTabs = page.locator('button[role="tab"], button:has-text("All"), button:has-text("Weekly")');
    const tabCount = await filterTabs.count();

    for (let i = 0; i < tabCount; i++) {
      const tab = filterTabs.nth(i);
      if (await tab.isVisible()) {
        const evalResult = await detector.evaluateElement(tab);
        expect(
          evalResult.classification,
          `Filter tab at index ${i} failed interaction check: ${evalResult.reason}`
        ).not.toBe('DEFINITELY_BROKEN');
      }
    }
  });

  test('Leaderboard Page: Verify department filters and pagination triggers', async ({ page }) => {
    await page.goto('/leaderboard', { waitUntil: 'domcontentloaded' });
    const detector = new DeadUIDetector(page);

    await expect(page.locator('main')).toBeVisible();

    const interactiveControls = page.locator('button, select, [role="button"]').filter({
      hasNotText: 'Delete',
    });

    const count = await interactiveControls.count();
    expect(count).toBeGreaterThan(0);

    const sampleCount = Math.min(count, 5);
    for (let i = 0; i < sampleCount; i++) {
      const control = interactiveControls.nth(i);
      if (await control.isVisible()) {
        const res = await detector.evaluateElement(control);
        expect(
          res.classification,
          `Leaderboard control ${i} is broken: ${res.reason}`
        ).not.toBe('DEFINITELY_BROKEN');
      }
    }
  });
});
