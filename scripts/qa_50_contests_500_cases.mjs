#!/usr/bin/env node
/**
 * 🛡️ CHAOS COMPUTER CLUB — 50-CONTEST / 110-CADET / 500+ TEST-CASE QA SUITE v2
 *
 * All API response shapes verified against live production before writing assertions.
 * Runs as: node scripts/qa_50_contests_500_cases.mjs
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.API_BASE_URL || 'https://medicaps.chaoscomputerclub.in/api';
const PROCTOR_KEY = process.env.PROCTOR_KEY || '1337';

const c = {
  reset: '\x1b[0m', bright: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m',
};

const results = { total: 0, passed: 0, failed: 0, testCases: [] };

function pass(id, name, details = '', latency = 0) {
  results.total++; results.passed++;
  console.log(`${c.green}✓ [${id}]${c.reset} (${latency.toFixed(0)}ms) ${name} ${c.dim}— ${details}${c.reset}`);
  results.testCases.push({ id, name, passed: true, details, latency: +latency.toFixed(1) });
}
function fail(id, name, details = '', latency = 0) {
  results.total++; results.failed++;
  console.error(`${c.red}✗ [${id}]${c.reset} (${latency.toFixed(0)}ms) ${name} ${c.bright}— ${details}${c.reset}`);
  results.testCases.push({ id, name, passed: false, details, latency: +latency.toFixed(1) });
}
function check(id, name, condition, onTrue, onFalse, latency = 0) {
  condition ? pass(id, name, onTrue, latency) : fail(id, name, onFalse, latency);
}

async function api(endpoint, method = 'GET', body = null) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Proctor-Key': PROCTOR_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const latency = performance.now() - t0;
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data, latency };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message, latency: performance.now() - t0 };
  }
}

// Helper: normalise any list endpoint that may return flat array OR wrapped object
const asList = (d, ...keys) => {
  if (Array.isArray(d)) return d;
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k];
  return [];
};

async function main() {
  console.log(`\n${c.bright}${c.cyan}${'='.repeat(80)}${c.reset}`);
  console.log(`${c.bright} 🛡️  CCC — 50 CONTESTS / 110 CADETS / 500+ CASE QA SUITE v2${c.reset}`);
  console.log(`${c.dim} Target: ${BASE_URL}${c.reset}`);
  console.log(`${c.bright}${c.cyan}${'='.repeat(80)}\n${c.reset}`);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 0: Health Gate — ensure production is alive before anything else
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`${c.yellow}⚡ Phase 0: Production Health Gate${c.reset}`);
  const health = await api('/health');
  check('P0-T01', 'API Health — operational', health.ok && health.data?.status === 'operational',
    `status="${health.data?.status}" version="${health.data?.version}"`,
    `HTTP ${health.status} — ${JSON.stringify(health.data)?.slice(0, 80)}`, health.latency);
  check('P0-T02', 'Redis connectivity', health.data?.services?.redis === 'ok',
    'Redis OK', `Redis=${health.data?.services?.redis}`, 0.1);
  check('P0-T03', 'Judge engine active', health.data?.services?.judge_healthy === true,
    `provider="${health.data?.services?.judge_provider}"`,
    `judge_healthy=${health.data?.services?.judge_healthy}`, 0.1);
  if (!health.ok) { console.error('Health gate failed — aborting.'); process.exit(1); }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Tournament Simulation
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 1: 50-Contest, 110-Cadet Tournament Simulation${c.reset}`);
  const simRes = await api('/admin/qa/simulate-tournament', 'POST', {
    cadet_count: 110, contest_count: 50,
    primary_handle: 'santusht', primary_email: 'santusht.en23@medicaps.ac.in',
    primary_name: 'Santusht Kotai', primary_prn: 'EN23CS301927',
  });
  const sim = simRes.data || {};
  check('P1-T01', 'Tournament simulation — HTTP 200', simRes.ok && sim.success === true,
    `50 contests, 110 cadets, ${sim.total_finalists_qualified} finalists in ${simRes.latency.toFixed(0)}ms`,
    `HTTP ${simRes.status}: ${JSON.stringify(sim).slice(0, 100)}`, simRes.latency);
  check('P1-T02', '50 Contests created', sim.total_contests_created === 50,
    `Created exactly 50 arena contests`, `Got ${sim.total_contests_created}`, 0.1);
  check('P1-T03', '110 Cadets enrolled', sim.total_cadets === 110,
    '110 unique Medi-Caps cadets seeded', `Got ${sim.total_cadets}`, 0.1);
  check('P1-T04', '5,500 Screening evaluations', sim.total_screenings_evaluated === 5500,
    '110 cadets × 50 contests all screened', `Got ${sim.total_screenings_evaluated}`, 0.1);
  check('P1-T05', '1,500 Top-30 finalist slots', sim.total_finalists_qualified === 1500,
    '30 finalists × 50 contests', `Got ${sim.total_finalists_qualified}`, 0.1);
  check('P1-T06', '200 Arena problems generated', sim.total_problems_generated === 200,
    '4 problems × 50 contests', `Got ${sim.total_problems_generated}`, 0.1);
  check('P1-T07', 'Target cadet Santusht is Grandmaster+',
    sim.target_cadet?.rating >= 2000,
    `Rating: ${sim.target_cadet?.rating} (${sim.target_cadet?.tier})`,
    `Rating only ${sim.target_cadet?.rating}`, 0.1);
  check('P1-T08', 'Santusht has podium finishes', (sim.target_cadet?.podiums || 0) >= 5,
    `${sim.target_cadet?.podiums} podium finishes`, `Only ${sim.target_cadet?.podiums}`, 0.1);
  check('P1-T09', 'Santusht attended 50 contests', sim.target_cadet?.contests_attended === 50,
    `Attended all 50`, `Attended ${sim.target_cadet?.contests_attended}`, 0.1);
  check('P1-T10', 'Contest sample present in response', Array.isArray(sim.contests_sample) && sim.contests_sample.length >= 1,
    `First contest: "${sim.contests_sample?.[0]?.title}"`, 'No sample', 0.1);

  if (!simRes.ok) { console.error('Simulation failed — aborting per-contest loop.'); process.exit(1); }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Contest List Verification
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 2: Contest Catalogue${c.reset}`);
  const cListRes = await api('/contests?limit=100');
  const allContests = asList(cListRes.data, 'items', 'contests');
  const arenaContests = allContests.filter(c => c.slug?.startsWith('ccc-arena-contest-'))
    .sort((a, b) => (a.edition || 0) - (b.edition || 0));

  check('P2-T01', '50 arena contests in catalogue', arenaContests.length === 50,
    `Found ${arenaContests.length}/50`, `Only ${arenaContests.length}/50 arena contests found`, cListRes.latency);
  check('P2-T02', 'Contest list is an array', Array.isArray(allContests),
    `${allContests.length} total contests`, `Got: ${typeof allContests}`, 0.1);
  const firstContest = arenaContests[0];
  check('P2-T03', 'Contest #1 metadata correct',
    firstContest?.seat_capacity === 30 && firstContest?.registered_count === 110,
    `capacity=30, registered=110`, `capacity=${firstContest?.seat_capacity}, registered=${firstContest?.registered_count}`, 0.1);
  check('P2-T04', 'Contest venue is Lab 04',
    firstContest?.venue?.includes('Lab 04') || firstContest?.venue?.includes('Lab04'),
    firstContest?.venue, `venue="${firstContest?.venue}"`, 0.1);
  check('P2-T05', 'Contest status=finished',
    arenaContests.every(c => c.status === 'finished'),
    'All 50 marked finished', `Some not finished: ${arenaContests.filter(c=>c.status!=='finished').map(c=>c.slug).slice(0,3).join(',')}`, 0.1);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Per-Contest Deep Assertions (Contests 1-50 → 10 checks each = 500)
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 3: Per-Contest Assertions (50 × 10 = 500 checks)${c.reset}`);

  for (let k = 1; k <= 50; k++) {
    const contest = arenaContests[k - 1];
    const slug = contest?.slug || `ccc-arena-contest-${String(k).padStart(2, '0')}`;
    const pfx = `C${String(k).padStart(2, '0')}`;

    // T01: Metadata integrity
    check(`${pfx}-T01`, `#${k} Metadata: slug, capacity=30, registered=110`,
      Boolean(contest) && contest.seat_capacity === 30 && contest.registered_count === 110,
      `"${slug}" ✓`, `contest=${JSON.stringify(contest)?.slice(0,60)}`, 0);

    // T02: 4 Arena problems
    const probRes = await api(`/admin/contests/${slug}/problems`);
    const problems = asList(probRes.data, 'problems');
    check(`${pfx}-T02`, `#${k} 4 Arena Problems (A-D)`,
      problems.length === 4,
      `A(100) B(250) C(500) D(1000)`,
      `Found ${problems.length} problems (HTTP ${probRes.status})`, probRes.latency);

    // T03: 110 participants
    const partRes = await api(`/admin/contests/${slug}/participants`);
    const participants = asList(partRes.data, 'participants');
    check(`${pfx}-T03`, `#${k} 110 Cadet Registrations`,
      participants.length === 110,
      `${participants.length} cadets registered`, `Got ${participants.length} (HTTP ${partRes.status})`, partRes.latency);

    // T04: All 110 screened
    const screened = participants.filter(p => p.assessment_taken === true).length;
    check(`${pfx}-T04`, `#${k} All 110 Screened`,
      screened === 110,
      `${screened}/110 took assessment`, `Only ${screened} screened`, 0);

    // T05: Exactly 30 Top-qualified
    const qualified = participants.filter(p => p.is_top_30_qualified === true).length;
    const eliminated = participants.filter(p => p.is_top_30_qualified === false).length;
    check(`${pfx}-T05`, `#${k} Strict Top-30 Cutoff`,
      qualified === 30 && eliminated === 80,
      `30 qualified / 80 eliminated`, `qual=${qualified} elim=${eliminated}`, 0);

    // T06: 30 campus passes with LAB-04 seats
    const passRes = await api(`/passes/contest/${slug}/attendees`);
    const attendees = asList(passRes.data, 'attendees');
    const validPasses = attendees.length === 30 && attendees.every(a => a.seat_number?.startsWith('LAB-04-PC'));
    check(`${pfx}-T06`, `#${k} 30 QR Passes — LAB-04-PC seats`,
      validPasses,
      `${attendees.length} passes, seats: ${attendees[0]?.seat_number}..${attendees[29]?.seat_number}`,
      `passes=${attendees.length}, seat0="${attendees[0]?.seat_number}"`, passRes.latency);

    // T07: All admitted at gate
    const admitted = attendees.filter(a => a.check_in_status === 'admitted').length;
    check(`${pfx}-T07`, `#${k} All 30 Turnstile-Admitted`,
      admitted === 30,
      `All 30 admitted by Chief Proctor`, `Only ${admitted}/30 admitted`, 0);

    // T08: Scoreboard has 30 ranked entries
    const sbRes = await api(`/scoreboards/${slug}`);
    const entries = asList(sbRes.data, 'entries');
    const validSb = entries.length === 30
      && entries[0]?.rank === 1
      && entries[29]?.rank === 30;
    check(`${pfx}-T08`, `#${k} Scoreboard 30-entry ranking`,
      validSb,
      `rank#1="${entries[0]?.handle}" rank#30="${entries[29]?.handle}"`,
      `entries=${entries.length}, rank0=${entries[0]?.rank}, rank29=${entries[29]?.rank}`, sbRes.latency);

    // T09: Santusht in Top 30
    const sEntry = entries.find(e => e.handle === 'santusht' || e.full_name?.toLowerCase().includes('santusht'));
    check(`${pfx}-T09`, `#${k} Santusht in Top-30`,
      Boolean(sEntry),
      `Rank #${sEntry?.rank}, ${sEntry?.solved} solved, delta ${sEntry?.rating_delta}`,
      `Not found on scoreboard`, 0);

    // T10: Rating deltas on all entries
    const allDeltas = entries.length > 0 && entries.every(e => typeof e.rating_delta === 'number');
    check(`${pfx}-T10`, `#${k} Elo Deltas — all 30 entries`,
      allDeltas,
      `Min Δ=${Math.min(...entries.map(e=>e.rating_delta||0))} Max Δ=${Math.max(...entries.map(e=>e.rating_delta||0))}`,
      `entries=${entries.length} with deltas: ${entries.filter(e=>typeof e.rating_delta==='number').length}`, 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 4: Santusht Kotai Full Profile & Rating Graph
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 4: Santusht Kotai — Profile, Rating Graph & Badges${c.reset}`);
  const profRes = await api('/auth/profile/santusht');
  const prof = profRes.data || {};
  const member = prof.member || {};
  const ratingHist = prof.ratingHistory || [];
  const achievements = prof.achievements || [];
  const problemStats = prof.problemStats || {};
  const recentBattles = prof.recentBattles || [];

  check('P4-T01', 'Profile endpoint returns member', Boolean(member.handle),
    `handle="${member.handle}" rating=${member.rating}`, `member=${JSON.stringify(member).slice(0,80)}`, profRes.latency);
  check('P4-T02', '50-point Rating Graph data', ratingHist.length >= 50,
    `${ratingHist.length} rating entries`, `Only ${ratingHist.length} entries`, 0.1);
  check('P4-T03', 'Rating climbed from 1200 to Grandmaster', member.rating >= 2000,
    `Current=${member.rating}, Peak=${member.peak_rating}`, `Current rating only ${member.rating}`, 0.1);
  check('P4-T04', 'Peak rating tracked correctly', member.peak_rating >= member.rating,
    `Peak=${member.peak_rating} ≥ Current=${member.rating}`, `Peak=${member.peak_rating} < Current=${member.rating}`, 0.1);
  check('P4-T05', 'University rank is top-3', (member.university_rank || 99) <= 3,
    `Rank #${member.university_rank}`, `Rank #${member.university_rank}`, 0.1);
  check('P4-T06', 'Attendance 50/50', member.attendance_count >= 50,
    `${member.attendance_count}/${member.attendance_total} contests attended`, `attendance=${member.attendance_count}`, 0.1);
  check('P4-T07', 'Podium finishes badge present',
    achievements.some(a => a.id === 'podium' || a.title?.includes('Podium')),
    `Badges: ${achievements.map(a=>a.title).join(', ')}`, 'No podium badge found', 0.1);
  check('P4-T08', 'Contest Veteran badge (5+ contests)',
    achievements.some(a => a.id === 'veteran' || a.title?.includes('Veteran')),
    'Veteran badge present', 'No veteran badge', 0.1);
  check('P4-T09', 'Elite/Grandmaster badge (rating ≥2000)',
    achievements.some(a => a.id === 'elite' || a.title?.includes('Elite') || a.title?.includes('Grandmaster')),
    `Elite badge present`, 'No elite badge (may need rating ≥2000)', 0.1);
  check('P4-T10', 'Problem solving stats populated',
    problemStats.total_solved > 0, `${problemStats.total_solved} solved (E:${problemStats.easy_solved} M:${problemStats.medium_solved} H:${problemStats.hard_solved})`,
    `total_solved=${problemStats.total_solved}`, 0.1);
  check('P4-T11', 'Recent battles history', recentBattles.length >= 5,
    `${recentBattles.length} recent battles`, `Only ${recentBattles.length}`, 0.1);
  check('P4-T12', 'Core member flag set', member.is_core_member === true,
    'is_core_member=true (Admin / QA)', `is_core_member=${member.is_core_member}`, 0.1);
  check('P4-T13', 'Rating graph delta sign integrity',
    ratingHist.every(r => typeof r.delta === 'number'),
    'All deltas are numbers', `Some missing deltas`, 0.1);
  check('P4-T14', 'Submission calendar populated',
    prof.submissionCalendar && Object.keys(prof.submissionCalendar || {}).length > 0,
    `${Object.keys(prof.submissionCalendar||{}).length} calendar days`, 'Calendar empty', 0.1);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 5: University Leaderboard
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 5: University Leaderboard${c.reset}`);
  const leadRes = await api('/leaderboard?limit=150');
  const leadRows = asList(leadRes.data, 'leaderboard', 'members');
  const topRow = leadRows[0] || {};
  check('P5-T01', 'Leaderboard has ≥110 cadets', leadRows.length >= 110,
    `${leadRows.length} ranked`, `Only ${leadRows.length}`, leadRes.latency);
  check('P5-T02', 'Rank #1 is highest-rated', topRow.rating >= 2000,
    `#1: ${topRow.handle} (${topRow.rating} Elo)`, `#1 rating=${topRow.rating}`, 0.1);
  check('P5-T03', 'Santusht in top 3',
    leadRows.slice(0,3).some(r => r.handle === 'santusht'),
    'Santusht in top 3', 'Santusht not in top 3', 0.1);
  check('P5-T04', 'No duplicate ranks', leadRows.length === new Set(leadRows.map(r=>r.rank)).size,
    'All ranks unique', 'Duplicate ranks found', 0.1);
  check('P5-T05', 'Monotonic rank ordering',
    leadRows.every((r, i) => i === 0 || r.rank >= leadRows[i-1].rank),
    'Ranks ascending', 'Non-monotonic rank order', 0.1);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 6: Trust-of-Proof Certificates
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 6: Cryptographic Trust Proofs${c.reset}`);
  const proofRes = await api('/verify/proofs');
  const proofs = asList(proofRes.data, 'proofs');
  check('P6-T01', '≥150 Trust Proofs (3 podiums × 50 contests)', proofs.length >= 150,
    `${proofs.length} verified certs`, `Only ${proofs.length}`, proofRes.latency);
  check('P6-T02', 'Proofs have SHA-256 digests',
    proofs.length > 0 && proofs.every(p => p.sha256_digest?.length === 64),
    'All digests 64-char SHA-256', `${proofs.filter(p=>p.sha256_digest?.length===64).length}/${proofs.length}`, 0.1);
  check('P6-T03', 'Santusht has proof certificates',
    proofs.some(p => p.member_handle === 'santusht'),
    `Santusht cert: ${proofs.find(p=>p.member_handle==='santusht')?.certificate_id}`,
    'No cert for santusht', 0.1);
  check('P6-T04', 'Proof status=verified', proofs.every(p => p.status === 'verified'),
    'All verified', `${proofs.filter(p=>p.status!=='verified').length} non-verified`, 0.1);
  const santProof = proofs.find(p => p.member_handle === 'santusht');
  check('P6-T05', 'Proof contains proctor stamp',
    Boolean(santProof?.proctor_stamp), santProof?.proctor_stamp, 'No stamp', 0.1);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 7: Admin-Side Flaws Audit (Portal Admin Console)
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 7: Admin Console — Deep Flaw Detection${c.reset}`);

  // T1: Admin contest list returns all arena contests
  const adminCListRes = await api('/admin/contests?limit=100');
  const adminContests = asList(adminCListRes.data, 'contests', 'items');
  check('P7-T01', 'Admin contest list — 50+ contests', adminContests.length >= 50,
    `${adminContests.length} contests in admin view`, `Got ${adminContests.length}`, adminCListRes.latency);

  // T2: Admin participants for contest #1
  const slug1 = arenaContests[0]?.slug || 'ccc-arena-contest-01';
  const ap1 = await api(`/admin/contests/${slug1}/participants`);
  const parts1 = asList(ap1.data, 'participants');
  check('P7-T02', 'Admin participants — 110 cadets for contest #1',
    parts1.length === 110, `${parts1.length} cadets`, `${parts1.length} (HTTP ${ap1.status})`, ap1.latency);

  // T3: Assessment score present in admin participants
  const hasScore = parts1.some(p => typeof p.assessment_score === 'number');
  check('P7-T03', 'Admin participants have assessment_score', hasScore,
    'Scores populated', 'assessment_score missing in participants', 0.1);

  // T4: campus_pass_code in qualified participants
  const qualParts = parts1.filter(p => p.is_top_30_qualified);
  const hasCodes = qualParts.every(p => p.campus_pass_code);
  check('P7-T04', '30 qualified — all have campus_pass_code', qualParts.length === 30 && hasCodes,
    `${qualParts.length} qualified with pass codes`, `Only ${qualParts.length} qualified, codes=${hasCodes}`, 0.1);

  // T5: seat_assigned in qualified participants
  const hasSeats = qualParts.every(p => p.seat_assigned && p.seat_assigned.startsWith('LAB-04'));
  check('P7-T05', 'Qualified cadets have LAB-04 seats', hasSeats,
    `seat_assigned = LAB-04-PC01..30`, `${qualParts.filter(p=>!p.seat_assigned?.startsWith('LAB-04')).length} missing`, 0.1);

  // T6: Admin contest create is guarded (no auth should fail)
  const unauthedCreate = await api('/admin/contests', 'POST', { slug: 'test-unauth', title: 'Hack Attempt' });
  check('P7-T06', 'Admin POST /contests — requires auth (401/403)',
    unauthedCreate.status === 401 || unauthedCreate.status === 403,
    `Correctly rejected: HTTP ${unauthedCreate.status}`, `Allowed unauthenticated creation! HTTP ${unauthedCreate.status}`, unauthedCreate.latency);

  // T7: Admin simulate-tournament requires core/admin auth
  const unauthedSim = await fetch(`${BASE_URL}/admin/qa/simulate-tournament`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer INVALID_TOKEN' },
    body: '{}' });
  const unauthedSimStatus = unauthedSim.status;
  check('P7-T07', 'Admin simulate-tournament — rejects bad JWT', unauthedSimStatus === 401 || unauthedSimStatus === 403,
    `HTTP ${unauthedSimStatus}`, `Allowed with invalid JWT: ${unauthedSimStatus}`, 0.1);

  // T8: Admin problems endpoint for finished contest
  const adminProbs = await api(`/admin/contests/${slug1}/problems`);
  const apList = asList(adminProbs.data, 'problems');
  check('P7-T08', 'Admin problems endpoint — 4 problems', apList.length === 4,
    `A B C D`, `Found ${apList.length}`, adminProbs.latency);

  // T9: Assessment endpoint shape
  const assessRes = await api(`/assessment/${slug1}`);
  check('P7-T09', 'Assessment endpoint responds', assessRes.status !== 0,
    `HTTP ${assessRes.status}`, `Network error: ${assessRes.error}`, assessRes.latency);

  // T10: Gate scanner endpoint
  const gateRes = await api(`/passes/scan`, 'POST', { pass_code: 'INVALID-CODE-999' });
  check('P7-T10', 'Gate scanner — rejects invalid pass code (400/404)',
    gateRes.status === 400 || gateRes.status === 404 || gateRes.status === 422,
    `HTTP ${gateRes.status} correctly rejected`, `Unexpectedly accepted: HTTP ${gateRes.status}`, gateRes.latency);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 8: Student Portal Flaw Detection
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 8: Student Portal — Deep Flaw Detection${c.reset}`);

  // T1: OTP endpoint returns dev_otp when SMTP disabled
  const otpRes = await api('/auth/send-otp', 'POST', { email: 'santusht.en23@medicaps.ac.in' });
  check('P8-T01', 'send-otp — 200 even with SMTP relay down',
    otpRes.ok, `HTTP ${otpRes.status} sent=${otpRes.data?.sent}`, `HTTP ${otpRes.status}`, otpRes.latency);
  check('P8-T02', 'send-otp — dev_otp fallback present (SMTP relay down)',
    Boolean(otpRes.data?.dev_otp),
    `dev_otp="${otpRes.data?.dev_otp}"`, 'dev_otp not present', 0.1);

  // T2: CORS header present on OTP response
  const otpFetch = await fetch(`${BASE_URL}/auth/send-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:8081' },
    body: JSON.stringify({ email: 'santusht.en23@medicaps.ac.in' })
  });
  const corsHeader = otpFetch.headers.get('access-control-allow-origin');
  check('P8-T03', 'CORS header present on send-otp',
    Boolean(corsHeader), `Access-Control-Allow-Origin: ${corsHeader}`, 'Missing CORS header', 0.1);

  // T3: Verify-OTP works end-to-end
  const devOtp = otpRes.data?.dev_otp;
  const txId = otpRes.data?.transaction_id;
  let accessToken = null;
  if (devOtp && txId) {
    const verRes = await api('/auth/verify-otp', 'POST', {
      email: 'santusht.en23@medicaps.ac.in', code: devOtp, transaction_id: txId
    });
    accessToken = verRes.data?.access_token;
    check('P8-T04', 'verify-otp — full OTP flow',
      verRes.ok && Boolean(accessToken),
      `JWT issued: ${accessToken?.slice(0,20)}...`, `HTTP ${verRes.status}`, verRes.latency);
    check('P8-T05', 'JWT — token_type=bearer', verRes.data?.token_type === 'bearer',
      'token_type=bearer', `token_type=${verRes.data?.token_type}`, 0.1);
  } else {
    fail('P8-T04', 'verify-otp — cannot test (no dev_otp)', 'send-otp did not provide dev_otp', 0);
    fail('P8-T05', 'JWT — cannot test', 'depends on P8-T04', 0);
  }

  // T4: /auth/me with valid JWT
  if (accessToken) {
    const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const me = await meRes.json().catch(() => {});
    check('P8-T06', '/auth/me — returns authenticated member',
      meRes.ok && Boolean(me?.id),
      `id=${me?.id} handle=${me?.handle}`, `HTTP ${meRes.status}`, 0);
  } else {
    fail('P8-T06', '/auth/me — skipped (no token)', 'depends on P8-T04', 0);
  }

  // T5: Contest list is public (no auth)
  const pubContests = await api('/contests?limit=5');
  check('P8-T07', 'Contest list — public access (no auth)',
    pubContests.ok, `HTTP ${pubContests.status}, ${asList(pubContests.data,'items').length} contests`,
    `HTTP ${pubContests.status}`, pubContests.latency);

  // T6: Profile of another cadet is public
  const pubProf = await api('/auth/profile/cadet_002');
  check('P8-T08', 'Cadet profile — public access (no auth)',
    pubProf.ok && Boolean(pubProf.data?.member),
    `handle="${pubProf.data?.member?.handle}" rating=${pubProf.data?.member?.rating}`,
    `HTTP ${pubProf.status}`, pubProf.latency);

  // T7: Verify email privacy (email not exposed on other cadet profile)
  const otherEmail = pubProf.data?.member?.email;
  check('P8-T09', 'Cadet profile — email hidden for non-self',
    !otherEmail || otherEmail === '',
    `email not exposed`, `email="${otherEmail}" exposed publicly!`, 0.1);

  // T8: Leaderboard is paginated correctly
  const pb1 = await api('/leaderboard?limit=10&offset=0');
  const pb2 = await api('/leaderboard?limit=10&offset=10');
  const rows1 = asList(pb1.data, 'leaderboard', 'members');
  const rows2 = asList(pb2.data, 'leaderboard', 'members');
  check('P8-T10', 'Leaderboard pagination works',
    rows1.length === 10 && rows2.length === 10 && rows1[0]?.handle !== rows2[0]?.handle,
    `page1[0]=${rows1[0]?.handle} page2[0]=${rows2[0]?.handle}`,
    `rows1=${rows1.length} rows2=${rows2.length}`, pb2.latency);

  // T9: Rate limiting / double-send OTP (idempotency)
  const otp2 = await api('/auth/send-otp', 'POST', { email: 'santusht.en23@medicaps.ac.in' });
  check('P8-T11', 'send-otp — idempotent on re-send (200 again)',
    otp2.ok, `second send: HTTP ${otp2.status}`, `HTTP ${otp2.status}`, otp2.latency);

  // T10: Social follow endpoint basics
  const socialRes = await api('/social/my-following-ids');
  check('P8-T12', '/social/my-following-ids — responds (public or 401)',
    socialRes.status === 200 || socialRes.status === 401,
    `HTTP ${socialRes.status}`, `Unexpected HTTP ${socialRes.status}`, socialRes.latency);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 9: Assessment Workflow E2E
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 9: Assessment Workflow${c.reset}`);
  const aListRes = await api('/assessment/list');
  const assessments = asList(aListRes.data, 'assessments', 'items');
  check('P9-T01', 'Assessment list endpoint', aListRes.ok,
    `HTTP ${aListRes.status} ${assessments.length} assessments`, `HTTP ${aListRes.status}`, aListRes.latency);
  check('P9-T02', '50 assessments created (one per contest)', assessments.length >= 50,
    `${assessments.length} assessments`, `Only ${assessments.length}`, 0.1);

  const firstAssess = assessments[0];
  if (firstAssess) {
    const singleA = await api(`/assessment/${firstAssess.slug || firstAssess.id}`);
    check('P9-T03', 'Single assessment GET', singleA.ok || singleA.status === 403,
      `HTTP ${singleA.status}`, `Network error: ${singleA.error}`, singleA.latency);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 10: Feed, Announcements & Social
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.yellow}⚡ Phase 10: Feed, Announcements & Social${c.reset}`);
  const feedRes = await api('/feed');
  check('P10-T01', 'Feed endpoint responds', feedRes.ok || feedRes.status === 401,
    `HTTP ${feedRes.status}`, `Error: ${feedRes.error}`, feedRes.latency);
  const annoRes = await api('/events');
  check('P10-T02', '/events endpoint responds', annoRes.ok,
    `HTTP ${annoRes.status}`, `HTTP ${annoRes.status}`, annoRes.latency);
  const socialFeedRes = await api('/social/my-following-ids');
  check('P10-T03', 'Social endpoint responds', socialFeedRes.status !== 0,
    `HTTP ${socialFeedRes.status}`, `Network error`, socialFeedRes.latency);

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${c.bright}${c.cyan}${'='.repeat(80)}${c.reset}`);
  const rate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`${c.bright} Results: ${results.total} Total | ${c.green}${results.passed} Passed${c.reset}${c.bright} | ${c.red}${results.failed} Failed${c.reset}${c.bright} | ${rate}% Success Rate${c.reset}`);
  console.log(`${c.bright}${c.cyan}${'='.repeat(80)}\n${c.reset}`);

  if (results.failed === 0) {
    console.log(`${c.bright}${c.green}✨ ALL ${results.total} TEST CASES PASSED — 100% SUCCESS!${c.reset}\n`);
  } else {
    console.error(`${c.bright}${c.red}❌ ${results.failed} TEST(S) FAILED — SEE DETAILS ABOVE${c.reset}\n`);
    console.log(`${c.yellow}FAILURES:${c.reset}`);
    results.testCases.filter(t => !t.passed).forEach(t => {
      console.log(`  ${c.red}• [${t.id}] ${t.name}${c.reset}\n    ${t.details}`);
    });
  }

  const reportPath = path.join(process.cwd(), '.planning', 'qa', 'tournament_50_contests_report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ ...results, timestamp: new Date().toISOString() }, null, 2));
  console.log(`${c.dim}✓ Report saved: ${reportPath}${c.reset}\n`);

  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
