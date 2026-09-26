import { test, expect } from '@playwright/test';
import { AccessibilityRunner } from './helpers/axe_runner';
import { authenticateCadetSession } from './helpers/auth_fixture';

test.describe('WCAG 2.2 AA Accessibility Audits', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateCadetSession(page);
  });
  test('Home Page meets core accessibility standards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('main').waitFor({ state: 'visible' });
    const runner = new AccessibilityRunner(page);

    const report = await runner.audit();
    const criticalViolations = report.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

    expect(
      criticalViolations.length,
      `Critical/Serious a11y violations found on Home page: ${JSON.stringify(criticalViolations, null, 2)}`
    ).toBe(0);
  });

  test('Contests Hub Page meets core accessibility standards', async ({ page }) => {
    await page.goto('/contests', { waitUntil: 'networkidle' });
    await page.locator('main').waitFor({ state: 'visible' });
    const runner = new AccessibilityRunner(page);

    const report = await runner.audit();
    const criticalViolations = report.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

    expect(
      criticalViolations.length,
      `Critical/Serious a11y violations found on Contests Hub: ${JSON.stringify(criticalViolations, null, 2)}`
    ).toBe(0);
  });

  test('Leaderboard Page meets core accessibility standards', async ({ page }) => {
    await page.goto('/leaderboard', { waitUntil: 'networkidle' });
    await page.locator('main').waitFor({ state: 'visible' });
    const runner = new AccessibilityRunner(page);

    const report = await runner.audit();
    const criticalViolations = report.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

    expect(
      criticalViolations.length,
      `Critical/Serious a11y violations found on Leaderboard: ${JSON.stringify(criticalViolations, null, 2)}`
    ).toBe(0);
  });
});
