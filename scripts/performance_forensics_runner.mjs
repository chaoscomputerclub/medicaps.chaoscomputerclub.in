import { chromium } from 'playwright';
import fs from 'node:fs';

const PROFILES = [
  { name: 'Fast (20 Mbps, 20ms RTT)', downloadThroughput: (20 * 1024 * 1024) / 8, uploadThroughput: (10 * 1024 * 1024) / 8, latency: 20 },
  { name: 'Moderate (5 Mbps, 100ms RTT)', downloadThroughput: (5 * 1024 * 1024) / 8, uploadThroughput: (2.5 * 1024 * 1024) / 8, latency: 100 },
  { name: 'Slow (1 Mbps, 300ms RTT)', downloadThroughput: (1 * 1024 * 1024) / 8, uploadThroughput: (500 * 1024) / 8, latency: 300 },
  { name: 'Degraded (400 Kbps, 500ms RTT)', downloadThroughput: (400 * 1024) / 8, uploadThroughput: (200 * 1024) / 8, latency: 500 },
];

const TARGET_URL = process.env.TARGET_URL || 'https://medicaps.chaoscomputerclub.in';

async function measureProfile(browser, profile) {
  console.log(`\n--- Measuring: ${profile.name} on ${TARGET_URL} ---`);
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

  const requests = [];
  let totalTransferredBytes = 0;

  page.on('request', (req) => {
    requests.push({
      url: req.url(),
      resourceType: req.resourceType(),
      method: req.method(),
      startTime: Date.now(),
    });
  });

  page.on('response', async (res) => {
    try {
      const headers = res.headers();
      const cl = headers['content-length'];
      if (cl) totalTransferredBytes += parseInt(cl, 10);
    } catch {}
  });

  // 1. Initial Load (Cold)
  const navStart = Date.now();
  let ttfb = 0;
  let domContentLoaded = 0;
  let loadTime = 0;

  try {
    const response = await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 45000 });
    loadTime = Date.now() - navStart;
    const timing = response?.request()?.timing();
    if (timing) {
      ttfb = Math.round(timing.responseStart);
    }
  } catch (err) {
    console.error(`Page load timeout or error on ${profile.name}:`, err.message);
    loadTime = Date.now() - navStart;
  }

  // Measure Web Vitals via PerformanceObserver in browser context
  const webVitals = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let fcp = 0;
      let lcp = 0;
      let cls = 0;

      const pEntries = performance.getEntriesByType('paint');
      for (const entry of pEntries) {
        if (entry.name === 'first-contentful-paint') {
          fcp = Math.round(entry.startTime);
        }
      }

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            lcp = Math.round(entry.startTime);
          }
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            cls += entry.value;
          }
        }
      });

      try {
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch {}

      setTimeout(() => {
        observer.disconnect();
        resolve({ fcp, lcp, cls: Math.round(cls * 1000) / 1000 });
      }, 1500);
    });
  });

  console.log(`Results: Load: ${loadTime}ms | FCP: ${webVitals.fcp}ms | LCP: ${webVitals.lcp}ms | CLS: ${webVitals.cls} | Requests: ${requests.length} | Bytes: ${(totalTransferredBytes / 1024).toFixed(1)} KB`);

  // Count requests by category
  const fontReqs = requests.filter(r => r.url.includes('font') || r.resourceType === 'font');
  const jsReqs = requests.filter(r => r.resourceType === 'script');
  const apiReqs = requests.filter(r => r.url.includes('/api/'));

  await context.close();

  return {
    profile: profile.name,
    loadTimeMs: loadTime,
    fcpMs: webVitals.fcp,
    lcpMs: webVitals.lcp,
    cls: webVitals.cls,
    totalRequests: requests.length,
    fontRequests: fontReqs.length,
    jsRequests: jsReqs.length,
    apiRequests: apiReqs.length,
    transferredBytes: totalTransferredBytes,
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const p of PROFILES) {
    try {
      const res = await measureProfile(browser, p);
      results.push(res);
    } catch (err) {
      console.error(`Failed on profile ${p.name}:`, err);
    }
  }

  await browser.close();
  fs.writeFileSync('docs/performance/synthetic_benchmark_results.json', JSON.stringify(results, null, 2));
  console.log('\n✓ Saved results to docs/performance/synthetic_benchmark_results.json');
}

run();
