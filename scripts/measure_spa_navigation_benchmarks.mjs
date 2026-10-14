import { chromium } from 'playwright';
import fs from 'node:fs';

const PROFILES = [
  { name: 'Fast (20 Mbps, 20ms)', downloadThroughput: (20 * 1024 * 1024) / 8, uploadThroughput: (10 * 1024 * 1024) / 8, latency: 20 },
  { name: 'Moderate (5 Mbps, 100ms)', downloadThroughput: (5 * 1024 * 1024) / 8, uploadThroughput: (2.5 * 1024 * 1024) / 8, latency: 100 },
  { name: 'Slow (1 Mbps, 300ms)', downloadThroughput: (1 * 1024 * 1024) / 8, uploadThroughput: (500 * 1024) / 8, latency: 300 },
  { name: 'Degraded (400 Kbps, 500ms)', downloadThroughput: (400 * 1024) / 8, uploadThroughput: (200 * 1024) / 8, latency: 500 },
];

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8081';

async function runBenchmark() {
  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  for (const profile of PROFILES) {
    console.log(`\n========================================`);
    console.log(`BENCHMARKING PROFILE: ${profile.name}`);
    console.log(`========================================`);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });

    const page = await context.newPage();
    const client = await context.newCDPSession(page);

    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.latency,
      downloadThroughput: profile.downloadThroughput,
      uploadThroughput: profile.uploadThroughput,
    });

    // Mock/Inject authenticated cadet session
    const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'qa_cadet@medicaps.ac.in',
      handle: 'qa_cadet',
      exp,
      is_core_member: false,
    })).toString('base64url');
    const token = `${header}.${payload}.sig`;
    const member = {
      id: '00000000-0000-0000-0000-000000000001',
      handle: 'qa_cadet',
      full_name: 'QA Cadet Sentinel',
      email: 'qa_cadet@medicaps.ac.in',
      rating: 1540,
      peak_rating: 1620,
      attendance_count: 8,
      attendance_total: 10,
      is_core_member: false,
      is_onboarded: true,
    };

    await page.addInitScript(({ t, m }) => {
      window.localStorage.setItem('ccc_medicaps_token', t);
      window.localStorage.setItem('ccc_medicaps_member', JSON.stringify(m));
    }, { t: token, m: member });

    // Initial page load
    const loadStart = performance.now();
    await page.goto(`${TARGET_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('aside nav[aria-label="Portal navigation"]', { timeout: 25000 });
    const initialLoadMs = Math.round(performance.now() - loadStart);
    console.log(`Initial Dashboard Boot: ${initialLoadMs} ms`);

    const routes = [
      { name: 'Contests Hub', path: '/contests', selector: 'text=/Active & Upcoming/i' },
      { name: 'Leaderboard', path: '/leaderboard', selector: 'text=/University Rating Standings/i' },
      { name: 'Practice Arena', path: '/practice', selector: 'text=/Practice Platform|Problem Archive/i' },
      { name: 'Cadet Profile', path: '/profile', selector: 'text=/Cadet Dossier|Enrollment No/i' },
      { name: 'Settings', path: '/settings', selector: 'text=/Account Settings/i' },
    ];

    const routeMetrics = [];

    for (const r of routes) {
      const link = page.locator(`aside a[href="${r.path}"]`).first();
      await link.waitFor({ state: 'visible', timeout: 5000 });

      // 1. Hover (triggers intent prefetch)
      const hoverStart = performance.now();
      await link.hover();
      await page.waitForTimeout(100);

      // 2. Click & Transition
      const t0 = performance.now();
      await link.click();
      await page.waitForURL(new RegExp(r.path));
      const urlTransitionMs = Math.round(performance.now() - t0);

      // 3. First Meaningful Content (skeleton resolved)
      await page.waitForSelector(r.selector, { timeout: 20000 }).catch(() => {});
      const contentReadyMs = Math.round(performance.now() - t0);

      console.log(` -> Nav to ${r.name.padEnd(16)} | URL: ${urlTransitionMs}ms | Content: ${contentReadyMs}ms`);
      routeMetrics.push({
        route: r.name,
        path: r.path,
        urlTransitionMs,
        contentReadyMs,
      });
    }

    // 4. Test repeated navigation (Warm Cache)
    console.log(`\nTesting Warm Repeated Navigation (Cache Hits):`);
    const warmMetrics = [];
    for (const r of routes.slice(0, 3)) {
      const link = page.locator(`aside a[href="${r.path}"]`).first();
      const t0 = performance.now();
      await link.click();
      await page.waitForURL(new RegExp(r.path));
      await page.waitForSelector(r.selector, { timeout: 10000 }).catch(() => {});
      const warmContentReadyMs = Math.round(performance.now() - t0);
      console.log(` -> Warm ${r.name.padEnd(16)} | Content: ${warmContentReadyMs}ms`);
      warmMetrics.push({ route: r.name, path: r.path, warmContentReadyMs });
    }

    allResults.push({
      profile: profile.name,
      initialLoadMs,
      coldNavigation: routeMetrics,
      warmNavigation: warmMetrics,
    });

    await context.close();
  }

  await browser.close();
  fs.writeFileSync('docs/performance/spa_navigation_forensics.json', JSON.stringify(allResults, null, 2));
  console.log(`\n✓ All navigation forensic measurements saved to docs/performance/spa_navigation_forensics.json`);
}

runBenchmark().catch(console.error);
