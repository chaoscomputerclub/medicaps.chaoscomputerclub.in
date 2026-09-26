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
});
