import { test, expect } from '@playwright/test';
import { authenticateCadetSession } from './helpers/auth_fixture';

test.describe('Runtime Telemetry & Error Boundary Sentinel', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateCadetSession(page);
  });

  const targetRoutes = ['/', '/contests', '/leaderboard'];

  for (const route of targetRoutes) {
    test(`Zero unhandled exceptions or 5xx failures on route: ${route}`, async ({ page }) => {
      const pageErrors: string[] = [];
      const failedRequests: Array<{ url: string; status: number }> = [];

      // Intercept unhandled JS exceptions
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      // Intercept failed HTTP responses
      page.on('response', (response) => {
        const status = response.status();
        if (status >= 500) {
          failedRequests.push({ url: response.url(), status });
        }
      });

      // Navigate to route
      await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {
        // Fallback if networkidle takes longer than 20s
      });

      // Assert zero uncaught JS exceptions
      expect(
        pageErrors,
        `Unhandled JavaScript exceptions occurred on ${route}:\n${pageErrors.join('\n')}`
      ).toHaveLength(0);

      // Assert zero 5xx backend server errors
      expect(
        failedRequests,
        `Server returned 5xx errors on ${route}:\n${JSON.stringify(failedRequests, null, 2)}`
      ).toHaveLength(0);

      // Verify that React ErrorBoundary is not rendered
      const errorBoundaryText = page.locator('text=/Something went wrong|Application Error|Crash Report/i');
      await expect(errorBoundaryText).not.toBeVisible();
    });
  }
});
