import { chromium } from "playwright";

async function profile(url) {
  console.log(`\n==================================================`);
  console.log(`Profiling initial load for: ${url}`);
  console.log(`==================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const requests = [];
  page.on("request", (req) => {
    requests.push({
      url: req.url(),
      method: req.method(),
      startTime: Date.now(),
    });
  });

  page.on("requestfinished", (req) => {
    const r = requests.find((x) => x.url === req.url());
    if (r) {
      r.endTime = Date.now();
      r.duration = r.endTime - r.startTime;
    }
  });

  page.on("requestfailed", (req) => {
    const r = requests.find((x) => x.url === req.url());
    if (r) {
      r.endTime = Date.now();
      r.duration = r.endTime - r.startTime;
      r.failed = true;
      r.error = req.failure()?.errorText;
    }
  });

  page.on("console", (msg) => {
    console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error(`[Browser PageError]:`, err);
  });

  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.log(`Navigation timeout or error: ${e.message}`);
  }
  const totalTime = Date.now() - t0;

  console.log(`\n--- Network Requests (${requests.length} total) ---`);
  for (const r of requests) {
    console.log(
      `${(r.duration || 0).toString().padStart(5)}ms | ${r.failed ? "FAIL" : "OK  "} | ${r.method} ${r.url.slice(0, 100)} ${r.error ? `(${r.error})` : ""}`
    );
  }

  // Check performance metrics
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByType("paint");
    return {
      navigation: nav ? {
        domInteractive: nav.domInteractive,
        domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
        loadEventEnd: nav.loadEventEnd,
        duration: nav.duration,
      } : null,
      paints: paint.map(p => ({ name: p.name, startTime: p.startTime })),
    };
  });

  console.log(`\n--- Performance Timings ---`);
  console.log(JSON.stringify(perf, null, 2));
  console.log(`Total Wall Clock to NetworkIdle: ${totalTime}ms`);

  const currentUrl = page.url();
  console.log(`Final URL: ${currentUrl}`);

  await browser.close();
}

async function main() {
  await profile("https://medicaps.chaoscomputerclub.in/");
  await profile("http://localhost:8081/");
}

main().catch(console.error);
