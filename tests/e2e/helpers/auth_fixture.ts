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

  await page.addInitScript(
    ({ t, m }) => {
      window.localStorage.setItem('ccc_medicaps_token', t);
      window.localStorage.setItem('ccc_medicaps_member', JSON.stringify(m));
    },
    { t: token, m: member }
  );
}
