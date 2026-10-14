import { chromium } from 'playwright';
import fs from 'node:fs';

const PROFILES = [
  { name: 'Fast (20 Mbps, 20ms)', downloadThroughput: (20 * 1024 * 1024) / 8, uploadThroughput: (10 * 1024 * 1024) / 8, latency: 20 },
  { name: 'Slow (1 Mbps, 300ms)', downloadThroughput: (1 * 1024 * 1024) / 8, uploadThroughput: (500 * 1024) / 8, latency: 300 },
];

const TARGET_URL = process.env.TARGET_URL || 'https://medicaps.chaoscomputerclub.in';

async function measureNavigation(browser, profile) {
  console.log(`\n=== Measuring SPA Navigation: ${profile.name} ===`);
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

  // Navigate to landing/auth/dashboard
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

  const routesToTest = ['/contests', '/leaderboard', '/practice'];
  const navTimings = [];

  for (const route of routesToTest) {
    const link = page.locator(`a[href="${route}"]`).first();
    const isVisible = await link.isVisible().catch(() => false);

    if (isVisible) {
      // Measure hover prefetch duration
      await link.hover().catch(() => {});
      await page.waitForTimeout(150);

      const t0 = performance.now();
      await link.click();
      await page.waitForURL(new RegExp(route), { timeout: 15000 }).catch(() => {});
      const urlTransitionMs = Math.round(performance.now() - t0);

      // Measure until skeleton disappears or main content is usable
      const t1 = performance.now();
      await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15000 }).catch(() => {});
      const contentReadyMs = Math.round(performance.now() - t0);

      console.log(`Route: ${route} | URL transition: ${urlTransitionMs}ms | Content ready: ${contentReadyMs}ms`);
      navTimings.push({ route, urlTransitionMs, contentReadyMs });
    } else {
      console.log(`Route link ${route} not found or auth redirected`);
    }
  }

  await context.close();
  return { profile: profile.name, timings: navTimings };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const allNav = [];
  for (const p of PROFILES) {
    try {
      const res = await measureNavigation(browser, p);
      allNav.push(res);
    } catch (e) {
      console.error(e);
    }
  }
  await browser.close();
  fs.writeFileSync('docs/performance/navigation_benchmark_results.json', JSON.stringify(allNav, null, 2));
  console.log('\n✓ Navigation benchmark saved to docs/performance/navigation_benchmark_results.json');
}

run();
