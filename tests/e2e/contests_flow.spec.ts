import { test, expect } from '@playwright/test';
import { authenticateCadetSession } from './helpers/auth_fixture';

test.describe('Contests Hub & User Journey E2E Flow', () => {
  test('Contests Hub mounts cleanly with LightRays and official contests', async ({ page }) => {
    // 1. Authenticate cadet session
    await authenticateCadetSession(page);

    // 2. Navigate to Contests Hub
    await page.goto('/contests', { waitUntil: 'domcontentloaded' });

    // 2. Validate URL and document title
    await expect(page).toHaveURL(/\/contests/);

    // 3. Verify LightRays WebGL canvas container is present
    const lightRaysContainer = page.locator('.custom-rays, canvas');
    await expect(lightRaysContainer.first()).toBeAttached({ timeout: 10000 });

    // 4. Verify main header text
    const heading = page.locator('h1, [data-testid="hub-heading"]').filter({
      hasText: /Contest/i,
    });
    await expect(heading.first()).toBeVisible({ timeout: 10000 });

    // 5. Verify Weekly Contest 1 card is displayed
    const contestCard = page.locator('text=/Weekly Contest/i').first();
    await expect(contestCard).toBeVisible({ timeout: 15000 });

    // 6. Verify single action button exists on the card
    const actionButton = page.locator('button:has-text("Register"), button:has-text("Enter Arena"), button:has-text("Details"), a:has-text("Details")').first();
    await expect(actionButton).toBeVisible({ timeout: 10000 });
  });

  test('Contest card navigation leads to valid contest overview', async ({ page }) => {
    await authenticateCadetSession(page);
    await page.goto('/contests', { waitUntil: 'domcontentloaded' });

    // Wait for contest card to hydrate and become visible
    const contestTitle = page.locator('text=/Weekly Contest/i').first();
    await expect(contestTitle).toBeVisible({ timeout: 15000 });

    // Locate the contest card
    const contestCard = page.locator('[data-testid="hero-contest-card"], [role="button"], a[href^="/contests/"]').filter({ hasText: /Weekly Contest/i }).first();
    await expect(contestCard).toBeVisible({ timeout: 10000 });

    // Click the contest card
    await contestCard.click();

    // Verify navigation landed on contest overview
    await page.waitForURL(/\/contests\/.+/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/contests\/.+/);

    // Verify contest overview rendered
    const overviewContent = page.locator('main, section');
    await expect(overviewContent.first()).toBeVisible();
  });

  test('Contest state is unified across Dashboard and Contests Hub', async ({ page }) => {
    await authenticateCadetSession(page);

    // 1. Visit Dashboard and retrieve contest banner details
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const contestSection = page.locator('section').filter({
      hasText: /(?:Tournament Live|Next Campus Tournament)/i,
    });
    await expect(contestSection.first()).toBeVisible({ timeout: 15000 });

    const dashTitle = await contestSection.locator('h2').first().innerText();
    const dashLink = await contestSection.locator('a[href^="/contests/"]').first().getAttribute('href');

    expect(dashTitle.trim().length).toBeGreaterThan(0);
    expect(dashLink).toBeTruthy();

    // 2. Visit Contests Hub and retrieve hero card details
    await page.goto('/contests', { waitUntil: 'domcontentloaded' });
    const hubCard = page.locator('[data-testid="hero-contest-card"]').first();
    await expect(hubCard).toBeVisible({ timeout: 15000 });

    const hubTitle = await hubCard.locator('h3, a, span').filter({ hasText: /Weekly Contest/i }).first().innerText();
    const hubLink = await hubCard.locator('a[href^="/contests/"]').first().getAttribute('href');

    // 3. Assert exact parity between both views
    expect(dashTitle.trim()).toBe(hubTitle.trim());
    expect(dashLink).toBe(hubLink);
  });

  test('REG-STATE-001: Contest registration state converges across list, detail, and reload', async ({ page }) => {
    let isRegisteredServer = false;
    const contestSlug = 'weekly-contest-1';

    // Intercept registration endpoints dynamically
    await page.route(`**/contests/${contestSlug}/register`, async (route) => {
      isRegisteredServer = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'confirmed',
          registered: true,
          contest_id: 'c-test-01',
          contest_slug: contestSlug,
          registered_at: new Date().toISOString(),
          message: 'Registration confirmed for Weekly Contest 1. Online arena unlocked.',
          registered_count: 42,
          capacity: 100,
        }),
      });
    });

    await page.route(`**/contests/${contestSlug}/registration-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registered: isRegisteredServer,
          contest_slug: contestSlug,
          status: isRegisteredServer ? 'confirmed' : null,
          can_enter_live_contest: false,
          can_take_assessment: false,
          is_top_30_qualified: true,
          is_checked_in: true,
        }),
      });
    });

    await authenticateCadetSession(page);

    // 1. Navigate to Contests Hub
    await page.goto('/contests', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/contests/);

    // 2. Open contest card to navigate to detail
    const contestCard = page.locator('text=/Weekly Contest/i').first();
    await expect(contestCard).toBeVisible({ timeout: 15000 });
    await contestCard.click();

    // 3. Confirm we are on the contest detail page
    await page.waitForURL(/\/contests\/.+/, { timeout: 10000 });

    // 4. If Register button is visible, click Register
    const registerBtn = page.locator('button').filter({ hasText: /^Register$/i }).first();
    if (await registerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await registerBtn.click();
    }

    // 5. Verify registered indicator appears on detail page
    const registeredIndicator = page.locator('button, [data-testid="badge"], span').filter({ hasText: /Registered/i }).first();
    await expect(registeredIndicator).toBeVisible({ timeout: 10000 });

    // 6. Navigate back to Contests Hub
    await page.goto('/contests', { waitUntil: 'domcontentloaded' });
    const hubRegistered = page.locator('button, span').filter({ hasText: /Registered/i }).first();
    await expect(hubRegistered).toBeVisible({ timeout: 10000 });

    // 7. Return to contest detail
    const contestCardAgain = page.locator('text=/Weekly Contest/i').first();
    await contestCardAgain.click();
    await page.waitForURL(/\/contests\/.+/, { timeout: 10000 });
    await expect(registeredIndicator).toBeVisible({ timeout: 10000 });

    // 8. Hard reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(registeredIndicator).toBeVisible({ timeout: 10000 });
  });
});
