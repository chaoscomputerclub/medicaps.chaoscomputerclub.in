import { Page } from '@playwright/test';

/**
 * Creates and injects an active authenticated session into the browser context.
 */
export async function authenticateCadetSession(page: Page, options?: { handle?: string; fullName?: string }): Promise<void> {
  const handle = options?.handle || 'qa_cadet';
  const fullName = options?.fullName || 'QA Cadet Sentinel';
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days in future

  // Construct valid base64url JWT
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: '00000000-0000-0000-0000-000000000001',
      email: `${handle}@medicaps.ac.in`,
      handle,
      exp,
      iat: Math.floor(Date.now() / 1000),
      is_core_member: false,
    })
  ).toString('base64url');
  const signature = 'sig_test_sentinel';
  const token = `${header}.${payload}.${signature}`;

  const member = {
    id: '00000000-0000-0000-0000-000000000001',
    handle,
    full_name: fullName,
    email: `${handle}@medicaps.ac.in`,
    prn: 'EN23CS301999',
    department: 'Computer Science & Engineering',
    batch: '2023-2027',
    rating: 1540,
    peak_rating: 1620,
    attendance_count: 8,
    attendance_total: 10,
    is_core_member: false,
    is_onboarded: true,
    avatar_url: null,
  };

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        member,
      }),
    });
  });

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: token,
        member,
      }),
    });
  });

  await page.route('**/auth/profile*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        member,
        ratingHistory: [],
        recentBattles: [],
      }),
    });
  });

  await page.route('**/contests/my/participated', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/social/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        following_ids: [],
        followers: [],
        following: [],
        students: [],
      }),
    });
  });

  await mockContestsApi(page);

  await page.addInitScript(
    ({ t, m }) => {
      window.localStorage.setItem('ccc_medicaps_token', t);
      window.localStorage.setItem('ccc_medicaps_member', JSON.stringify(m));
    },
    { t: token, m: member }
  );
}

/**
 * Mocks official contests endpoints with realistic test fixture data
 * ensuring E2E tests pass regardless of backend contest database population.
 */
export async function mockContestsApi(page: Page): Promise<void> {
  const mockContest = {
    id: '00000000-0000-0000-0000-000000000002',
    slug: 'weekly-contest-1',
    title: 'Weekly Contest 1',
    season: 'Season 1',
    summary: 'Official competitive programming round for Medi-Caps cadets.',
    status: 'upcoming',
    cadence: 'weekly',
    edition: 1,
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 86400000 + 7200000).toISOString(),
    check_in_opens_at: new Date(Date.now() + 86400000 - 1800000).toISOString(),
    venue: 'Lab-04, Ground Floor, Engineering Block',
    seat_capacity: 120,
    registered_count: 42,
    problem_count: 4,
    environment: 'Standard Linux GCC / Python 3.12 / Node.js 20',
    prize_pool: null,
    sponsor: null,
    rules: [
      'Zero tolerance for plagiarism and AI-assisted generation in arena.',
      'Bring university ID card for physical QR check-in.',
    ],
    chief_proctors: ['Dr. A. Sharma', 'Prof. R. Patel'],
    registered: false,
    assessment: null,
  };

  await page.route(/\/contests/, async (route) => {
    const req = route.request();
    const url = req.url();
    // NEVER intercept HTML document page navigations
    if (req.resourceType() === 'document' || req.isNavigationRequest()) {
      return route.continue();
    }
    if (url.includes('/registration-status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registered: false,
          contest_slug: 'weekly-contest-1',
          contest_status: 'upcoming',
          registered_at: null,
          assessment_taken: false,
          assessment_score: null,
          assessment_rank: null,
          assessment_status: null,
          is_top_30_qualified: false,
        }),
      });
    }
    if (url.includes('/weekly-contest-1')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContest),
      });
    }
    if (url.includes('/contests/my/')) {
      return route.continue();
    }
    if (url.endsWith('/contests') || url.includes('/contests?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockContest]),
      });
    }
    return route.continue();
  });
}

