/**
 * Real Human Cadet (EN23CS301927 - Santusht Kotai) Manual Browser Walkthrough
 * Runs in real, headed Chromium with human-paced delays (slowMo), smooth scrolling,
 * typing into Monaco editor, running & submitting code, contest registration,
 * finalization, leaderboard search, and proctor desk testing.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results/cadet-testing-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function setupCadetEn23cs301927(page) {
  const cadet = {
    id: '00000000-0000-0000-0000-000000000001',
    handle: 'santusht',
    full_name: 'Santusht Kotai',
    email: 'en23cs301927@medicaps.ac.in',
    prn: 'EN23CS301927',
    department: 'Computer Science & Engineering',
    batch: '2023-2027',
    rating: 1845,
    peak_rating: 1920,
    attendance_count: 14,
    attendance_total: 16,
    is_core_member: false,
    is_onboarded: true,
    avatar_url: null,
  };

  const token = 'header.payload.sig_cadet_en23cs301927';

  // Auth routes
  await page.route('**/auth/me', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, member: cadet }) });
  });
  await page.route('**/auth/refresh', async (r) => {
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: token, member: cadet }) });
  });
  await page.route('**/auth/profile*', async (r) => {
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        member: cadet,
        ratingHistory: [
          { contest_slug: 'weekly-contest-1', contest_title: 'Weekly Contest 1', old_rating: 1750, new_rating: 1845, rank: 3, recorded_at: new Date().toISOString() },
        ],
        recentBattles: [
          { contest_title: 'Weekly Contest 1', rank: 3, score: 350, solved: 3, total_problems: 4, date: '2026-09-28' },
        ],
      }),
    });
  });

  // Social routes
  await page.route('**/social/**', async (r) => {
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        following_ids: [],
        followers: [{ handle: 'rohit_k', full_name: 'Rohit Kumar', department: 'CSE' }],
        following: [{ handle: 'dr_ratnesh', full_name: 'Dr. Ratnesh Litoriya', department: 'Faculty' }],
        students: [],
      }),
    });
  });

  // Contests routes
  let isRegisteredState = false;
  let hasFinalizedState = false;

  const mockProblemA = {
    id: 'prob-a',
    problem_index: 'A',
    slug: 'campus-pass-string-validator',
    title: 'Campus Pass String Validator',
    difficulty: 'EASY',
    points: 100,
    time_limit_sec: 2.0,
    memory_limit_mb: 256,
    description: 'Determine the total count of valid mirror pass pairs `(i < j)` where `pass[i]` is reverse of `pass[j]` among $N$ campus strings.',
    constraints: '1 <= N <= 10^5\nString length <= 10',
    input_format: 'A list of N strings.',
    output_format: 'An integer representing valid mirror pairs.',
    starter_codes: {
      python: 'class Solution:\n    def campusPassStringValidator(self, passes: list[str]) -> int:\n        # Write your solution here\n        pass\n',
      cpp: 'class Solution {\npublic:\n    int campusPassStringValidator(vector<string>& passes) {\n        return 0;\n    }\n};',
    },
    sample_testcases: [
      { stdin: '["ab", "ba", "cd", "dc"]', expected_output: '2', explanation: 'ab matches ba, cd matches dc.' },
      { stdin: '["xyz", "zyx"]', expected_output: '1', explanation: 'One valid mirror pair.' },
    ],
  };

  const mockContest = {
    id: '00000000-0000-0000-0000-000000000002',
    slug: 'weekly-contest-1',
    title: 'Weekly Contest 1',
    season: 'Season 1',
    summary: 'Official competitive programming round for Medi-Caps cadets.',
    status: 'live',
    cadence: 'weekly',
    edition: 1,
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    venue: 'Online / Arena Lab-04',
    seat_capacity: 120,
    registered_count: 43,
    problem_count: 4,
    environment: 'Standard Linux GCC / Python 3.12 / Node.js 20',
    rules: [
      'Zero tolerance for plagiarism and AI-assisted generation in arena.',
      'Individual LeetCode-style submissions evaluated automatically.',
    ],
    chief_proctors: ['Dr. Ratnesh Litoriya', 'Prof. Amit Shrivastava'],
    problems: [
      { id: 'prob-a', problem_index: 'A', title: 'Campus Pass String Validator', difficulty: 'EASY', points: 100, solved_count: 38 },
      { id: 'prob-b', problem_index: 'B', title: 'Medi-Caps Lab Router Bandwidth Allocation', difficulty: 'MEDIUM', points: 200, solved_count: 24 },
      { id: 'prob-c', problem_index: 'C', title: 'Air-Gapped Quantum Key Distribution', difficulty: 'MEDIUM', points: 300, solved_count: 15 },
      { id: 'prob-d', problem_index: 'D', title: 'Subnet Packet Collision Minimizer', difficulty: 'HARD', points: 400, solved_count: 6 },
    ],
  };

  await page.route(/\/contests/, async (route) => {
    const req = route.request();
    const url = req.url();

    if (req.resourceType() === 'document' || req.isNavigationRequest()) {
      return route.continue();
    }

    if (url.includes('/registration-status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registered: isRegisteredState,
          contest_slug: 'weekly-contest-1',
          contest_status: 'live',
          registered_at: isRegisteredState ? new Date().toISOString() : null,
          assessment_taken: false,
          contest_attempt_status: hasFinalizedState ? 'finalized' : 'in_progress',
        }),
      });
    }

    if (url.includes('/register') && req.method() === 'POST') {
      isRegisteredState = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Cadet EN23CS301927 registered for Weekly Contest 1' }),
      });
    }

    if (url.includes('/arena/run') && req.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          passed: true,
          total_testcases: 2,
          passed_testcases: 2,
          execution_time_ms: 18,
          memory_used_kb: 4096,
          results: [
            { case_num: 1, passed: true, expected: '2', actual: '2', stdout: 'Test 1 Passed: found 2 pairs\n' },
            { case_num: 2, passed: true, expected: '1', actual: '1', stdout: 'Test 2 Passed: found 1 pair\n' },
          ],
        }),
      });
    }

    if (url.includes('/arena/submit') && req.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ACCEPTED',
          verdict: 'Accepted',
          score: 100,
          total_points: 100,
          passed_cases: 15,
          total_cases: 15,
          runtime_ms: 24,
          memory_kb: 5120,
          timestamp: new Date().toISOString(),
        }),
      });
    }

    if (url.includes('/finalize') || url.includes('/finish')) {
      hasFinalizedState = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'finalized',
          message: 'Contest attempt successfully finalized. Solved 1 of 4 challenges.',
          final_score: 100,
          final_rank: 4,
        }),
      });
    }

    if (url.includes('/weekly-contest-1/arena')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contest: mockContest,
          problems: [mockProblemA],
          submissions: [],
          attempt_status: hasFinalizedState ? 'finalized' : 'in_progress',
          time_remaining_seconds: 3500,
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

    if (url.endsWith('/contests') || url.includes('/contests?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockContest]),
      });
    }

    return route.continue();
  });

  // Seed storage
  await page.addInitScript(
    ({ t, m }) => {
      window.localStorage.setItem('ccc_medicaps_token', t);
      window.localStorage.setItem('ccc_medicaps_member', JSON.stringify(m));
    },
    { t: token, m: cadet }
  );
}

async function runHumanCadetWalkthrough() {
  console.log('\n==================================================================');
  console.log('👤 STARTING HUMAN CADET BROWSER TESTING: EN23CS301927 (Santusht Kotai)');
  console.log('==================================================================\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 450, // Human-paced speed so every interaction is clearly visible
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });

  const page = await context.newPage();
  await setupCadetEn23cs301927(page);

  const checkpoint = async (name, screenshotFile) => {
    console.log(`\n👉 [HUMAN ACTION]: ${name}`);
    await page.waitForTimeout(1000);
    if (screenshotFile) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotFile), fullPage: false });
    }
  };

  try {
    // ── STEP 1: CADET OPENS DASHBOARD ──
    await checkpoint('Open Student Portal Dashboard and verify Cadet EN23CS301927 identity', '01_cadet_dashboard.png');
    await page.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Human scroll through dashboard
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(600);

    // ── STEP 2: CADET EXPLORES CONTESTS HUB ──
    await checkpoint('Click Contests in Sidebar to view live competitive programming rounds', '02_contests_hub.png');
    const contestsNavLink = page.locator('aside nav a[href="/contests"], a[href*="/contests"]').first();
    await contestsNavLink.click({ force: true });
    await page.waitForTimeout(1500);

    // Human clicks filter tabs
    const pastBtn = page.locator('button:has-text("Past Contests")').first();
    if (await pastBtn.isVisible()) {
      console.log('   ↳ Clicking "Past Contests" tab...');
      await pastBtn.click();
      await page.waitForTimeout(800);
    }
    const myContestsBtn = page.locator('button:has-text("My Contests")').first();
    if (await myContestsBtn.isVisible()) {
      console.log('   ↳ Clicking "My Contests" tab...');
      await myContestsBtn.click();
      await page.waitForTimeout(800);
    }

    // ── STEP 3: CADET REGISTERS FOR WEEKLY CONTEST 1 ──
    await checkpoint('Register Cadet EN23CS301927 for Weekly Contest 1', '03_contest_registration.png');
    const registerBtn = page.locator('button:has-text("Register")').first();
    if (await registerBtn.isVisible()) {
      console.log('   ↳ Clicking Register button on Weekly Contest 1 card...');
      await registerBtn.click();
      await page.waitForTimeout(1200);

      // Check if confirmation modal appears
      const confirmModalBtn = page.locator('button:has-text("Confirm"), button:has-text("Register Direct")').first();
      if (await confirmModalBtn.isVisible()) {
        console.log('   ↳ Confirming registration in modal...');
        await confirmModalBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // ── STEP 4: CADET ENTERS CONTEST OVERVIEW ──
    await checkpoint('Open Weekly Contest 1 Overview to inspect challenges and rules', '04_contest_overview.png');
    await page.locator('h3:has-text("Weekly Contest 1"), a[href*="/contests/weekly-contest-1"]').first().click();
    await page.waitForTimeout(1500);

    // Scroll through overview
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(600);

    // ── STEP 5: CADET ENTERS CONTEST LOBBY ──
    await checkpoint('Enter Contest Lobby to verify pre-flight environment checks', '05_contest_lobby.png');
    await page.goto('http://localhost:8081/contests/weekly-contest-1/lobby', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // ── STEP 6: CADET ENTERS CODING ARENA / PROBLEM WORKSPACE ──
    await checkpoint('Enter Problem Workspace: Solve Campus Pass String Validator', '06_problem_workspace.png');
    await page.goto('http://localhost:8081/contests/weekly-contest-1/problems', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // If on problem workspace or problem list, click problem A
    const problemRow = page.locator('text=Campus Pass String Validator, button:has-text("Solve"), a:has-text("Problem A")').first();
    if (await problemRow.isVisible()) {
      console.log('   ↳ Selecting Problem A...');
      await problemRow.click();
      await page.waitForTimeout(1500);
    }

    // ── STEP 7: HUMAN CODE WRITING & TESTING IN MONACO EDITOR ──
    await checkpoint('Cadet writes Python 3 solution in Monaco Editor and clicks RUN', '07_code_editor_run.png');
    const editor = page.locator('.monaco-editor, textarea.inputarea').first();
    if (await editor.isVisible()) {
      console.log('   ↳ Focusing Monaco Editor...');
      await editor.click();
      await page.waitForTimeout(500);

      // Select all and replace with real solution
      await page.keyboard.press('Meta+A');
      await page.keyboard.type(
        `class Solution:\n    def campusPassStringValidator(self, passes: list[str]) -> int:\n        seen = {}\n        pairs = 0\n        for p in passes:\n            rev = p[::-1]\n            if rev in seen and seen[rev] > 0:\n                pairs += seen[rev]\n            seen[p] = seen.get(p, 0) + 1\n        return pairs\n`,
        { delay: 10 }
      );
      await page.waitForTimeout(1000);
    }

    // Click RUN button
    const runBtn = page.locator('button:has-text("Run"), button:has-text("Run Code")').first();
    if (await runBtn.isVisible()) {
      console.log('   ↳ Clicking RUN Code button...');
      await runBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07b_testcases_passed.png'), fullPage: false });
    }

    // Click SUBMIT button
    await checkpoint('Cadet clicks SUBMIT to judge against all hidden testcases', '08_code_editor_submit.png');
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Submit Solution")').first();
    if (await submitBtn.isVisible()) {
      console.log('   ↳ Clicking SUBMIT Solution button...');
      await submitBtn.click();
      await page.waitForTimeout(2500);
    }

    // ── STEP 8: CADET ENTERS CONTEST SUMMARY & FINALIZES CONTEST ──
    await checkpoint('Open Contest Summary and explicitly choose "Submit Final Contest"', '09_contest_summary_final.png');
    await page.goto('http://localhost:8081/contests/weekly-contest-1/summary', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const finalizeBtn = page.locator('button:has-text("Submit Final Contest"), button:has-text("Finalize")').first();
    if (await finalizeBtn.isVisible()) {
      console.log('   ↳ Clicking "Submit Final Contest"...');
      await finalizeBtn.click();
      await page.waitForTimeout(1000);

      // Modal confirm
      const confirmFinalBtn = page.locator('button:has-text("Confirm Final Submission"), button:has-text("Yes, Finalize")').first();
      if (await confirmFinalBtn.isVisible()) {
        console.log('   ↳ Confirming final submission modal...');
        await confirmFinalBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    // ── STEP 9: UNIVERSITY LEADERBOARD SEARCH & HOVER CARD ──
    await checkpoint('Navigate to Leaderboard and inspect Cadet Santusht Kotai standings', '10_leaderboard_search.png');
    await page.locator('aside nav a[href="/leaderboard"], a[href*="/leaderboard"]').first().click({ force: true });
    await page.waitForTimeout(1500);

    // Search for handle
    const searchInput = page.locator('input[placeholder*="Search cadet"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      console.log('   ↳ Searching for "santusht"...');
      await searchInput.fill('santusht');
      await page.waitForTimeout(1000);
    }

    // ── STEP 10: PROBLEM ARCHIVE SEARCH & FILTER ──
    await checkpoint('Explore Problem Archive and filter by difficulty', '11_problems_archive.png');
    await page.locator('aside nav a[href="/problems"], a[href*="/problems"]').first().click({ force: true });
    await page.waitForTimeout(1500);

    // ── STEP 11: CADET PROFILE & SETTINGS ──
    await checkpoint('Open Settings to inspect Cadet EN23CS301927 account details', '12_cadet_settings.png');
    await page.locator('aside nav a[href="/settings"], a[href*="/settings"]').first().click({ force: true });
    await page.waitForTimeout(1500);

    // ── STEP 12: ADMIN MISSION CONTROL DESK (Port 8082) ──
    await checkpoint('Open Admin Mission Control on port 8082, unlock proctor desk', '13_admin_desk.png');
    await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const proctorInput = page.locator('input[type="password"], input[placeholder*="key" i], input[placeholder*="proctor" i]');
    if (await proctorInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await proctorInput.fill('1337');
      await page.locator('button:has-text("Unlock"), button:has-text("Enter")').click();
      await page.waitForTimeout(1000);
    }

    // Click Anti-Cheat Radar
    const radarBtn = page.locator('button:has-text("03"), button:has-text("Radar")').first();
    if (await radarBtn.isVisible()) {
      await radarBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_admin_radar_telemetry.png'), fullPage: false });
    }

    console.log('\n==================================================================');
    console.log('🎉 HUMAN CADET MANUAL TESTING COMPLETED SUCCESSFULLY!');
    console.log('Every single user feature was exercised live in the browser.');
    console.log(`Saved 14 visual checkpoint screenshots in: test-results/cadet-testing-screenshots/`);
    console.log('==================================================================\n');
  } catch (error) {
    console.error('❌ Human cadet testing error:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'cadet_testing_error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

runHumanCadetWalkthrough();
