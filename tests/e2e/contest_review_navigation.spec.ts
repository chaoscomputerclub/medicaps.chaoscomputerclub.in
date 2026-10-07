import { test, expect } from '@playwright/test';
import { authenticateCadetSession } from './helpers/auth_fixture';

test.describe('Contest Review Navigation & Route State Machine', () => {
  const contestSlug = 'ccc-weekly-1';

  test.beforeEach(async ({ page }) => {
    // 1. Authenticate cadet session
    await authenticateCadetSession(page);

    // 2. Mock concluded contest data
    const mockContestDetail = {
      id: 'c-test-01',
      slug: contestSlug,
      title: 'CCC Weekly Contest 1',
      edition: 1,
      season: 'Season 2026',
      status: 'finished',
      starts_at: new Date(Date.now() - 7200000).toISOString(),
      ends_at: new Date(Date.now() - 3600000).toISOString(),
      summary: 'Weekly competitive programming challenge.',
      problems: [
        { id: 'prob-b', problem_index: 'B', title: 'Binary Search', points: 100, topic: 'Algorithms', difficulty: 'EASY' },
        { id: 'prob-c', problem_index: 'C', title: 'Best Time to Buy and Sell Stock', points: 100, topic: 'Dynamic Programming', difficulty: 'MEDIUM' },
        { id: 'prob-d', problem_index: 'D', title: 'Maximum Subarray', points: 200, topic: 'Arrays', difficulty: 'MEDIUM' },
        { id: 'prob-e', problem_index: 'E', title: 'Single Number', points: 100, topic: 'Bit Manipulation', difficulty: 'EASY' },
      ],
    };

    const mockArenaData = {
      contest_id: 'c-test-01',
      slug: contestSlug,
      title: 'CCC Weekly Contest 1',
      season: 'Season 2026',
      status: 'finished',
      starts_at: new Date(Date.now() - 7200000).toISOString(),
      ends_at: new Date(Date.now() - 3600000).toISOString(),
      venue: 'Lab Block A',
      environment: 'Air-Gapped Assessment Zone',
      chief_proctors: ['Chief Proctor', 'CCC Desk'],
      assigned_seat: 'ONLINE',
      pass_code: null,
      check_in_status: 'checked_in',
      is_proctored: true,
      is_submitted: true,
      is_review_mode: true,
      problems: [
        {
          id: 'prob-b',
          contest_id: 'c-test-01',
          problem_index: 'B',
          title: 'Binary Search',
          topic: 'Algorithms',
          points: 100,
          difficulty: 'EASY',
          description: 'Problem B Description: Given a sorted array of integers nums and an integer target, write a function to search target in nums.',
          input_format: 'Standard input format.',
          output_format: 'Standard output format.',
          constraints: 'Time Limit: 2.0s',
          starter_codes: { python: 'def solve(): pass' },
          sample_testcases: [{ input: '10 2', output: '5', explanation: 'Sample explanation' }],
        },
        {
          id: 'prob-c',
          contest_id: 'c-test-01',
          problem_index: 'C',
          title: 'Best Time to Buy and Sell Stock',
          topic: 'Dynamic Programming',
          points: 100,
          difficulty: 'MEDIUM',
          description: 'Problem C Description: You are given an array prices where prices[i] is the price of a given stock on the ith day.',
          input_format: 'Standard input format.',
          output_format: 'Standard output format.',
          constraints: 'Time Limit: 2.0s',
          starter_codes: { python: 'def solve(): pass' },
          sample_testcases: [{ input: '7 1 5 3 6 4', output: '5', explanation: 'Sample explanation' }],
        },
        {
          id: 'prob-d',
          contest_id: 'c-test-01',
          problem_index: 'D',
          title: 'Maximum Subarray',
          topic: 'Arrays',
          points: 200,
          difficulty: 'MEDIUM',
          description: 'Problem D Description: Find the subarray with the largest sum.',
          input_format: 'Standard input format.',
          output_format: 'Standard output format.',
          constraints: 'Time Limit: 2.0s',
          starter_codes: { python: 'def solve(): pass' },
          sample_testcases: [{ input: '-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: 'Sample explanation' }],
        },
        {
          id: 'prob-e',
          contest_id: 'c-test-01',
          problem_index: 'E',
          title: 'Single Number',
          topic: 'Bit Manipulation',
          points: 100,
          difficulty: 'EASY',
          description: 'Problem E Description: Find that single one.',
          input_format: 'Standard input format.',
          output_format: 'Standard output format.',
          constraints: 'Time Limit: 2.0s',
          starter_codes: { python: 'def solve(): pass' },
          sample_testcases: [{ input: '2 2 1', output: '1', explanation: 'Sample explanation' }],
        },
      ],
    };

    // Route mocks
    await page.route(`**/api/contests/${contestSlug}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContestDetail),
      });
    });

    await page.route(`**/api/contests/${contestSlug}/registration-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registered: true,
          status: 'submitted',
          assessment_taken: true,
          contest_status: 'finished',
          can_enter_live_contest: false,
          can_take_assessment: false,
          is_top_30_qualified: true,
          is_checked_in: true,
        }),
      });
    });

    await page.route(`**/api/contests/${contestSlug}/arena`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockArenaData),
      });
    });

    await page.route(`**/api/contests/${contestSlug}/arena/problems/*/submissions`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route(`**/api/contests/${contestSlug}/my-participations`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { contest_slug: contestSlug, status: 'submitted', total_score: 200 },
        ]),
      });
    });
  });

  test('NAV-001 & NAV-003: Review action in concluded contest opens selected problem review directly without redirecting to summary', async ({ page }) => {
    // 1. Open concluded contest detail page
    await page.goto(`/contests/${contestSlug}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/contests/${contestSlug}`));

    // 2. Verify contest status is CONCLUDED
    const concludedBadge = page.locator('span').filter({ hasText: /CONCLUDED/i }).first();
    await expect(concludedBadge).toBeVisible({ timeout: 10000 });

    // 3. Locate Problem B (Binary Search) review button
    const reviewBButton = page.locator('[data-testid="review-btn-B"], a[href*="binary-search/review"]').first();
    await expect(reviewBButton).toBeVisible({ timeout: 10000 });

    // 4. Click "Review" on Problem B
    await reviewBButton.click();

    // 5. Assert URL contains canonical Problem B review route
    await page.waitForURL(new RegExp(`/contests/${contestSlug}/problems/.+/review`), { timeout: 10000 });
    const currentUrl = page.url();
    expect(currentUrl).toContain(`/contests/${contestSlug}/problems/`);
    expect(currentUrl).toContain('/review');
    expect(currentUrl).toMatch(/binary-search/i);

    // 6. Assert Problem B description is displayed
    const problemBTitle = page.locator('text=/Binary Search/i').first();
    await expect(problemBTitle).toBeVisible({ timeout: 10000 });

    // 7. Assert Review Mode badge is present
    const reviewModeBadge = page.locator('text=/Review Mode/i').first();
    await expect(reviewModeBadge).toBeVisible();

    // 8. Assert Contest Summary is NOT visible
    const summaryHeading = page.locator('h1, h2').filter({ hasText: /Contest Summary & Submission Console/i });
    expect(await summaryHeading.count()).toBe(0);

    // 9. Assert live Submit button is locked/disabled or not active
    const liveSubmitBtn = page.locator('button').filter({ hasText: /^Submit$/i });
    expect(await liveSubmitBtn.count()).toBe(0);
  });

  test('NAV-002: Contest Summary only opens from explicit summary action', async ({ page }) => {
    // 1. Open concluded contest detail page
    await page.goto(`/contests/${contestSlug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // 2. Click explicit "View Summary" hero button
    const viewSummaryBtn = page.locator('a, button').filter({ hasText: /View Summary/i }).first();
    await expect(viewSummaryBtn).toBeVisible({ timeout: 10000 });
    await viewSummaryBtn.click();

    // 3. Assert URL is exactly the contest summary URL
    await page.waitForURL(new RegExp(`/contests/${contestSlug}/summary`), { timeout: 10000 });
    expect(page.url()).toContain(`/contests/${contestSlug}/summary`);

    // 4. In summary problem list, clicking "Review Problem" for Problem C navigates to Problem C review
    const problemCAction = page.locator('[data-testid="summary-action-C"], a[href*="stock"]').first();
    await expect(problemCAction).toBeVisible({ timeout: 10000 });
    await problemCAction.click();

    // 5. Assert URL is Problem C review
    await page.waitForURL(new RegExp(`/contests/${contestSlug}/problems/.+/review`), { timeout: 10000 });
    expect(page.url()).toContain('/review');
    expect(page.url()).toMatch(/stock|best-time/i);
  });

  test('NAV-004 & NAV-006: Browser Back & Forward preserves exact problem review state', async ({ page }) => {
    // 1. Navigate to Contest Overview
    await page.goto(`/contests/${contestSlug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // 2. Click Review on Problem B
    const reviewB = page.locator('[data-testid="review-btn-B"], a[href*="binary-search"]').first();
    await expect(reviewB).toBeVisible({ timeout: 10000 });
    await reviewB.click();
    await page.waitForURL(new RegExp(`/contests/${contestSlug}/problems/.+/review`), { timeout: 10000 });
    expect(page.url()).toMatch(/binary-search/i);

    // 3. Press browser Back
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/contests/${contestSlug}$`));

    // 4. Press browser Forward
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/contests/${contestSlug}/problems/.+/review`));
    expect(page.url()).toMatch(/binary-search/i);
  });

  test('NAV-007: Direct URL to Problem Review renders review workspace cleanly upon hard refresh', async ({ page }) => {
    // Direct URL navigation to Problem B review
    await page.goto(`/contests/${contestSlug}/problems/binary-search/review`, { waitUntil: 'domcontentloaded' });

    // Assert URL is preserved
    expect(page.url()).toContain(`/contests/${contestSlug}/problems/binary-search/review`);

    // Assert Problem B is rendered
    const problemTitle = page.locator('text=/Binary Search/i').first();
    await expect(problemTitle).toBeVisible({ timeout: 10000 });

    // Hard reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain(`/contests/${contestSlug}/problems/binary-search/review`);
    await expect(problemTitle).toBeVisible({ timeout: 10000 });
  });
});
