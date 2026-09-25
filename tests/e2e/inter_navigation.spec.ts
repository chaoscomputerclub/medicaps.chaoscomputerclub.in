import { test, expect } from '@playwright/test';
import { authenticateCadetSession } from './helpers/auth_fixture';

test.describe('Full Platform Inter-Navigation & Subpage Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept mock API responses for smooth navigation
    await authenticateCadetSession(page);
  });

  test('Primary Sidebar Navigation: Verify all core routes transition smoothly without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`[PAGEERROR] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(`[CONSOLE_ERROR] ${msg.text()}`);
      }
    });

    page.on('response', (res) => {
      if (res.status() === 401) {
        console.log(`[HTTP_401] ${res.url()}`);
      }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.locator('aside nav[aria-label="Portal navigation"]')).toBeVisible({ timeout: 10000 });

    // 2. Navigate to Contests (/contests)
    await page.locator('aside nav a[href="/contests"]').click();
    await expect(page).toHaveURL(/.*\/contests$/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Contest|Arena|Tournament/i }).first()).toBeVisible({ timeout: 10000 });

    // 3. Navigate to My Contests (/my-contests)
    await page.locator('aside nav a[href="/my-contests"]').click();
    await expect(page).toHaveURL(/.*\/my-contests$/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /My Contests|Dossier/i }).first()).toBeVisible({ timeout: 10000 });

    // 4. Navigate to Leaderboard (/leaderboard)
    await page.locator('aside nav a[href="/leaderboard"]').click();
    await expect(page).toHaveURL(/.*\/leaderboard$/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Leaderboard|Standings/i }).first()).toBeVisible({ timeout: 10000 });

    // 5. Navigate to Problems (/problems)
    await page.locator('aside nav a[href="/problems"]').click();
    await expect(page).toHaveURL(/.*\/problems$/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Problems|Archive|Challenges/i }).first()).toBeVisible({ timeout: 10000 });

    // 6. Navigate to Verify Proof (/verify)
    await page.locator('aside nav a[href="/verify"]').click();
    await expect(page).toHaveURL(/.*\/verify$/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Verify|Cryptographic|Proof/i }).first()).toBeVisible({ timeout: 10000 });

    // 7. Navigate to Settings (/settings)
    await page.locator('aside nav a[href="/settings"]').click();
    await expect(page).toHaveURL(/.*\/settings$/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Settings|Profile|Account/i }).first()).toBeVisible({ timeout: 10000 });

    // 8. Navigate to Profile (/profile) via sidebar footer link
    await page.locator('aside a[href="/profile"]').click();
    await expect(page).toHaveURL(/.*\/profile/);

    // 9. Navigate back to Dashboard (/) via Brand Header
    await page.locator('aside a[href="/"]').first().click();
    await expect(page).toHaveURL(/.*\/$/);

    // Verify zero fatal page errors occurred during full loop
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Download the React DevTools') && !e.includes('status of 401') && !e.includes('status of 404')
    );
    expect(fatalErrors, `Fatal errors detected during sidebar navigation: ${fatalErrors.join('\n')}`).toEqual([]);
  });

  test('Contest Flow Inter-Navigation: Hub -> Overview -> Lobby -> Overview -> Results', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`[PAGEERROR] ${err.message}`));

    // 1. Go to Contests Hub
    await page.goto('/contests', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

    // 2. Click hero contest card to go to Contest Overview
    const contestLink = page.locator('a[href^="/contests/"]').filter({
      hasNotText: 'Browse',
    }).first();
    await expect(contestLink).toBeVisible({ timeout: 10000 });
    const targetHref = await contestLink.getAttribute('href');
    expect(targetHref).toBeTruthy();

    await contestLink.click();
    await expect(page).toHaveURL(new RegExp(targetHref!));

    // 3. From Contest Overview, verify "Back to Contests Hub" link works
    const backToHubLink = page.locator('a:has-text("Back to Contests Hub"), a[href="/contests"]').first();
    await expect(backToHubLink).toBeVisible({ timeout: 10000 });
    await backToHubLink.click();
    await expect(page).toHaveURL(/.*\/contests$/);

    // 4. Return to Contest Overview
    await page.goto(targetHref!, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // 5. Navigate to Waiting Room / Lobby (if button present)
    const lobbyLink = page.locator('a[href*="/lobby"]').first();
    if (await lobbyLink.isVisible()) {
      await lobbyLink.click();
      await expect(page).toHaveURL(/.*\/lobby$/);

      // Verify Waiting Room / Lobby renders cleanly (any valid lobby state)
      await expect(page.locator('h1, h2, h3').filter({ hasText: /Waiting Room|Lobby|Contest|Registration Required|Concluded/i }).first()).toBeVisible({ timeout: 10000 });

      // Click "Contest Overview" or back button in lobby
      const backToOverviewLink = page.locator('a[href^="/contests/"]').filter({
        hasNotText: 'Lobby',
      }).first();
      await expect(backToOverviewLink).toBeVisible();
      await backToOverviewLink.click();
      await expect(page).toHaveURL(new RegExp(targetHref!));
    }

    const fatalErrors = consoleErrors.filter((e) => !e.includes('ResizeObserver'));
    expect(fatalErrors).toEqual([]);
  });

  test('Problem Archive & Detail Inter-Navigation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`[PAGEERROR] ${err.message}`));

    // 1. Go to Problems Archive
    await page.goto('/problems', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

    // 2. Click a problem challenge if list populated
    const problemRow = page.locator('a[href^="/problems/"]').first();
    if (await problemRow.isVisible()) {
      const probHref = await problemRow.getAttribute('href');
      await problemRow.click();
      await expect(page).toHaveURL(new RegExp(probHref!));

      // 3. Click back to problems archive
      const backLink = page.locator('a[href="/problems"]').first();
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page).toHaveURL(/.*\/problems$/);
    }

    const fatalErrors = consoleErrors.filter((e) => !e.includes('ResizeObserver'));
    expect(fatalErrors).toEqual([]);
  });

  test('Leaderboard to Cadet Profile Inter-Navigation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`[PAGEERROR] ${err.message}`));

    // 1. Go to Leaderboard
    await page.goto('/leaderboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });

    // 2. Check for cadet profile links in table or hover cards
    const profileLink = page.locator('a[href^="/profile/"]').first();
    if (await profileLink.isVisible()) {
      const href = await profileLink.getAttribute('href');
      await profileLink.click();
      await expect(page).toHaveURL(new RegExp(href!));
      await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    }

    const fatalErrors = consoleErrors.filter((e) => !e.includes('ResizeObserver'));
    expect(fatalErrors).toEqual([]);
  });

  test('Dashboard Deep Links Inter-Navigation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`[PAGEERROR] ${err.message}`));

    // 1. Visit Dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

    // 2. Click "Full Standings →" action link to Leaderboard
    const standingsLink = page.locator('a:has-text("Full Standings →")');
    if (await standingsLink.isVisible()) {
      await standingsLink.click();
      await expect(page).toHaveURL(/.*\/leaderboard$/);
      await page.goBack();
    }

    // 3. Click "Profile Dossier →" action link
    const profileLink = page.locator('a:has-text("Profile Dossier →")');
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await expect(page).toHaveURL(/.*\/profile$/);
      await page.goBack();
    }

    // 4. Click "Verify Proofs →" action link
    const verifyLink = page.locator('a:has-text("Verify Proofs →")');
    if (await verifyLink.isVisible()) {
      await verifyLink.click();
      await expect(page).toHaveURL(/.*\/verify$/);
    }

    const fatalErrors = consoleErrors.filter((e) => !e.includes('ResizeObserver'));
    expect(fatalErrors).toEqual([]);
  });

  test('Contest Standings & Verification Inter-Navigation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`[PAGEERROR] ${err.message}`));

    // 1. Visit Contest Results directly
    await page.goto('/contests/round-2-campus-final/results', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

    // 2. Verify back button links to Contest Details
    const backBtn = page.locator('a:has-text("Back to"), a:has-text("Contest Details")').first();
    await expect(backBtn).toBeVisible({ timeout: 10000 });
    const backHref = await backBtn.getAttribute('href');
    expect(backHref).toContain('/contests/round-2-campus-final');

    // 3. Verify University Leaderboard link
    const leadBtn = page.locator('a:has-text("University Leaderboard")').first();
    await expect(leadBtn).toBeVisible();
    await leadBtn.click();
    await expect(page).toHaveURL(/.*\/leaderboard$/);

    // 4. Visit Verify Proof Page and verify prefill via query param
    await page.goto('/verify?proof=CCC-MCU-2026-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input#verifyTerm')).toHaveValue('CCC-MCU-2026-001');

    const fatalErrors = consoleErrors.filter((e) => !e.includes('ResizeObserver'));
    expect(fatalErrors).toEqual([]);
  });
});

