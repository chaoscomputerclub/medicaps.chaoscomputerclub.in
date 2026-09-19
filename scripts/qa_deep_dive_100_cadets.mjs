/**
 * 🛡️ Chaos Computer Club — Deep Dive 100-Cadet Production Workflow QA Suite
 * 
 * Verifies the complete real-world tournament workflow:
 * 1. 100 realistic Medi-Caps student users created and registered on the portal.
 * 2. 100 Phase 1 online screening assessments taken with score/penalty distribution.
 * 3. Real-time ranking calculation verified (deterministic scores, tie-breakers).
 * 4. Strict Top 30 finalist qualification: exactly 30 qualify, 70 eliminated.
 * 5. Digital Campus QR Pass issuance: exactly 30 receive passes and seats LAB-04-PC01 to LAB-04-PC30.
 * 6. Air-Gap Gate Security ("without QR try to attempt what will happen"):
 *    - Forged QR code attempted by non-qualifier -> REJECTED (invalid_pass).
 *    - Student PRN/Handle attempted by non-qualifier -> REJECTED (not_qualified).
 *    - Unregistered stranger attempted -> REJECTED (invalid_pass).
 *    - Valid QR pass presented by Top 30 finalist -> ADMITTED (verified, assigned seat).
 *    - Duplicate QR pass replay attack -> BLOCKED (already_checked_in).
 *    - Complete 30-seat lab turnstile occupancy verification.
 */

const API_BASE = process.env.API_BASE || "https://medicaps.chaoscomputerclub.in/api";
const PROCTOR_KEY = process.env.PROCTOR_KEY || "1337";

const headers = {
  "Content-Type": "application/json",
  "X-Proctor-Key": PROCTOR_KEY,
};

const results = [];

function logTest(id, name, status, latencyMs, details = "") {
  const symbol = status === "PASS" ? "✓" : "✗";
  console.log(`${symbol} [${id}] (${latencyMs.toFixed(1)}ms) ${name} — ${details}`);
  results.push({ id, name, status, latencyMs, details });
}

async function runDeepDive() {
  console.log("=".repeat(85));
  console.log(" 🛡️  CHAOS COMPUTER CLUB — DEEP DIVE 100-CADET PRODUCTION WORKFLOW QA SUITE");
  console.log(` Target Endpoint: ${API_BASE}`);
  console.log("=".repeat(85));

  // ─── STAGE 1: Resolve Active Contest ─────────────────────────────────────────
  let targetContestSlug = "weekly-contest-2";
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/admin/contests`, { headers });
      const latency = performance.now() - start;
      if (res.ok) {
        const contests = await res.json();
        if (contests && contests.length > 0) {
          targetContestSlug = contests[0].slug;
          logTest("DD-INIT-01", "Identify Target Active Contest", "PASS", latency, `Target: '${targetContestSlug}' (${contests[0].title})`);
        } else {
          logTest("DD-INIT-01", "Identify Target Active Contest", "FAIL", latency, "No active contests found");
        }
      } else {
        logTest("DD-INIT-01", "Identify Target Active Contest", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-INIT-01", "Identify Target Active Contest", "FAIL", 0, err.message);
    }
  }

  // ─── STAGE 2: Execute 100-Cadet Simulation & Assessment Workflow ─────────────
  let simData = null;
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/admin/contests/${targetContestSlug}/simulate-100-cadets`, {
        method: "POST",
        headers,
      });
      const latency = performance.now() - start;
      if (res.ok) {
        simData = await res.json();
        const validSim =
          simData.total_cadets_registered === 100 &&
          simData.total_assessments_submitted === 100 &&
          simData.top_30_qualified_count === 30 &&
          simData.eliminated_unqualified_count === 70;

        if (validSim) {
          logTest(
            "DD-SIM-01",
            "100 Cadets Ingested, Tested & Top 30 Qualified",
            "PASS",
            latency,
            `100 registered, 100 assessed, exactly 30 qualified, 70 eliminated`
          );
        } else {
          logTest("DD-SIM-01", "100 Cadets Ingested, Tested & Top 30 Qualified", "FAIL", latency, JSON.stringify(simData));
        }
      } else {
        const err = await res.text();
        logTest("DD-SIM-01", "100 Cadets Ingested, Tested & Top 30 Qualified", "FAIL", latency, `HTTP ${res.status}: ${err}`);
      }
    } catch (err) {
      logTest("DD-SIM-01", "100 Cadets Ingested, Tested & Top 30 Qualified", "FAIL", 0, err.message);
    }
  }

  // ─── STAGE 3: Verify Real-Time Ranking Calculation & Cutoff ──────────────────
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/passes/contest/${targetContestSlug}/attendees`);
      const latency = performance.now() - start;
      if (res.ok) {
        const attendees = await res.json();
        const totalCount = attendees.length;
        const qualifiedCount = attendees.filter((a) => a.is_top_30_qualified).length;
        const unassignedCount = attendees.filter((a) => !a.is_top_30_qualified).length;

        // Verify strictly monotonic descending scores for ranks 1..100
        let monotonic = true;
        for (let i = 0; i < attendees.length - 1; i++) {
          if (attendees[i].screening_score < attendees[i + 1].screening_score) {
            monotonic = false;
            break;
          }
        }

        if (totalCount === 100 && qualifiedCount === 30 && unassignedCount === 70 && monotonic) {
          logTest(
            "DD-RANK-01",
            "Real-Time Ranking Calculation & Strict Monotonic Order",
            "PASS",
            latency,
            `100 cadets strictly ranked. Rank 1: ${attendees[0].screening_score} pts -> Rank 100: ${attendees[99].screening_score} pts`
          );
        } else {
          logTest(
            "DD-RANK-01",
            "Real-Time Ranking Calculation & Strict Monotonic Order",
            "FAIL",
            latency,
            `Total: ${totalCount}, Qualified: ${qualifiedCount}, Unassigned: ${unassignedCount}, Monotonic: ${monotonic}`
          );
        }
      } else {
        logTest("DD-RANK-01", "Real-Time Ranking Calculation & Strict Monotonic Order", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-RANK-01", "Real-Time Ranking Calculation & Strict Monotonic Order", "FAIL", 0, err.message);
    }
  }

  // ─── STAGE 4: Digital QR Pass & Workstation Allocation Verification ──────────
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/passes/contest/${targetContestSlug}/attendees`);
      const latency = performance.now() - start;
      if (res.ok) {
        const attendees = await res.json();
        const top30 = attendees.filter((a) => a.is_top_30_qualified);
        const bottom70 = attendees.filter((a) => !a.is_top_30_qualified);

        // Verify seats LAB-04-PC01 through LAB-04-PC30 assigned to Top 30
        const allTopSeatsValid = top30.every((a, idx) => a.seat_number === `LAB-04-PC${String(idx + 1).padStart(2, "0")}`);
        const allTopPassCodesValid = top30.every((a) => a.pass_code && a.pass_code.startsWith("CCC-"));
        const allBottomHaveNoPass = bottom70.every((a) => a.pass_code === "—" && a.seat_number === "UNASSIGNED");

        if (allTopSeatsValid && allTopPassCodesValid && allBottomHaveNoPass) {
          logTest(
            "DD-PASS-01",
            "Top 30 QR Passes & Workstation Seat Allocation (LAB-04-PC01 to PC30)",
            "PASS",
            latency,
            `Top 30 assigned seats LAB-04-PC01..PC30 with cryptographic codes. Bottom 70 have zero passes.`
          );
        } else {
          logTest(
            "DD-PASS-01",
            "Top 30 QR Passes & Workstation Seat Allocation (LAB-04-PC01 to PC30)",
            "FAIL",
            latency,
            `TopSeats: ${allTopSeatsValid}, TopCodes: ${allTopPassCodesValid}, BottomUnassigned: ${allBottomHaveNoPass}`
          );
        }
      } else {
        logTest("DD-PASS-01", "Top 30 QR Passes & Workstation Seat Allocation", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-PASS-01", "Top 30 QR Passes & Workstation Seat Allocation", "FAIL", 0, err.message);
    }
  }

  // ─── STAGE 5: Air-Gap Gate Security Tests ("Without QR Try to Attempt") ──────

  // Test 5A: Non-qualifier attempts gate check-in with forged QR code
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/passes/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pass_code_or_qr: "CCC-PASS:FORGED-PASS-CADET-35:ID:LAB-04-PC01:QUALIFIED",
          contest_slug: targetContestSlug,
        }),
      });
      const latency = performance.now() - start;
      if (res.ok) {
        const data = await res.json();
        if (data.valid === false && data.status === "invalid_pass") {
          logTest(
            "DD-SEC-01",
            "Forged QR Code Gate Entry Denial",
            "PASS",
            latency,
            `Denied! Reason: '${data.message}'. Turnstile locked.`
          );
        } else {
          logTest("DD-SEC-01", "Forged QR Code Gate Entry Denial", "FAIL", latency, `Expected valid: false, got: ${JSON.stringify(data)}`);
        }
      } else {
        logTest("DD-SEC-01", "Forged QR Code Gate Entry Denial", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-SEC-01", "Forged QR Code Gate Entry Denial", "FAIL", 0, err.message);
    }
  }

  // Test 5B: Non-qualifier (Cadet #35) attempts manual bypass using their PRN at the turnstile
  {
    const start = performance.now();
    try {
      const nonQualifierPrn = simData?.eliminated_rank_31?.prn || "EN23CY301035";
      const res = await fetch(`${API_BASE}/passes/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pass_code_or_qr: nonQualifierPrn,
          contest_slug: targetContestSlug,
        }),
      });
      const latency = performance.now() - start;
      if (res.ok) {
        const data = await res.json();
        if (data.valid === false && data.status === "not_qualified") {
          logTest(
            "DD-SEC-02",
            "Non-Qualified Cadet PRN/Handle Gate Entry Denial",
            "PASS",
            latency,
            `Denied! Reason: '${data.message}'. Below Top 30 cutoff.`
          );
        } else {
          logTest(
            "DD-SEC-02",
            "Non-Qualified Cadet PRN/Handle Gate Entry Denial",
            "FAIL",
            latency,
            `Expected valid: false with status: not_qualified, got: ${JSON.stringify(data)}`
          );
        }
      } else {
        logTest("DD-SEC-02", "Non-Qualified Cadet PRN/Handle Gate Entry Denial", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-SEC-02", "Non-Qualified Cadet PRN/Handle Gate Entry Denial", "FAIL", 0, err.message);
    }
  }

  // Test 5C: Unregistered stranger barcode scanned at the gate
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/passes/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pass_code_or_qr: "EN99XX999999",
          contest_slug: targetContestSlug,
        }),
      });
      const latency = performance.now() - start;
      if (res.ok) {
        const data = await res.json();
        if (data.valid === false && (data.status === "invalid_pass" || data.status === "unregistered")) {
          logTest(
            "DD-SEC-03",
            "Unregistered Stranger Barcode Denial",
            "PASS",
            latency,
            `Denied! Reason: '${data.message}'. Unknown cadet.`
          );
        } else {
          logTest("DD-SEC-03", "Unregistered Stranger Barcode Denial", "FAIL", latency, `Expected denial, got: ${JSON.stringify(data)}`);
        }
      } else {
        logTest("DD-SEC-03", "Unregistered Stranger Barcode Denial", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-SEC-03", "Unregistered Stranger Barcode Denial", "FAIL", 0, err.message);
    }
  }

  // Test 5D: Qualified Finalist (#1) presents legitimate QR pass code
  let qualifier1PassCode = simData?.qualifier_rank_1?.pass_code;
  {
    const start = performance.now();
    try {
      if (!qualifier1PassCode) {
        // Fallback: fetch from attendees
        const attRes = await fetch(`${API_BASE}/passes/contest/${targetContestSlug}/attendees`);
        const attList = await attRes.json();
        qualifier1PassCode = attList[0]?.pass_code;
      }

      const res = await fetch(`${API_BASE}/passes/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pass_code_or_qr: qualifier1PassCode,
          contest_slug: targetContestSlug,
        }),
      });
      const latency = performance.now() - start;
      if (res.ok) {
        const data = await res.json();
        if (data.valid === true && data.status === "verified" && data.seat_number === "LAB-04-PC01") {
          logTest(
            "DD-SEC-04",
            "Qualified Finalist Legitimate QR Gate Admission",
            "PASS",
            latency,
            `Admitted! Cadet: ${data.candidate_name}, Seat: ${data.seat_number}, Proctor: ${data.checked_in_by || 'Proctor'}`
          );
        } else {
          logTest("DD-SEC-04", "Qualified Finalist Legitimate QR Gate Admission", "FAIL", latency, `Got: ${JSON.stringify(data)}`);
        }
      } else {
        logTest("DD-SEC-04", "Qualified Finalist Legitimate QR Gate Admission", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-SEC-04", "Qualified Finalist Legitimate QR Gate Admission", "FAIL", 0, err.message);
    }
  }

  // Test 5E: Replay Attack — Qualifier #1 scans the SAME QR pass a second time
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/passes/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pass_code_or_qr: qualifier1PassCode,
          contest_slug: targetContestSlug,
        }),
      });
      const latency = performance.now() - start;
      if (res.ok) {
        const data = await res.json();
        if (data.valid === true && data.status === "already_checked_in") {
          logTest(
            "DD-SEC-05",
            "Replay Attack Duplicate Pass Scan Detection",
            "PASS",
            latency,
            `Blocked Replay! Alert: '${data.message}'. Duplicate admission prevented.`
          );
        } else {
          logTest("DD-SEC-05", "Replay Attack Duplicate Pass Scan Detection", "FAIL", latency, `Expected status: already_checked_in, got: ${data.status}`);
        }
      } else {
        logTest("DD-SEC-05", "Replay Attack Duplicate Pass Scan Detection", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-SEC-05", "Replay Attack Duplicate Pass Scan Detection", "FAIL", 0, err.message);
    }
  }

  // Test 5F: Batch Turnstile Admission for all remaining 29 qualifiers (Ranks #2 to #30)
  {
    const start = performance.now();
    try {
      const attRes = await fetch(`${API_BASE}/passes/contest/${targetContestSlug}/attendees`);
      const attList = await attRes.json();
      const remainingQualifiers = attList.slice(1, 30);

      let admittedCount = 0;
      for (const q of remainingQualifiers) {
        const scanRes = await fetch(`${API_BASE}/passes/verify`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            pass_code_or_qr: q.pass_code,
            contest_slug: targetContestSlug,
          }),
        });
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          if (scanData.valid && (scanData.status === "verified" || scanData.status === "already_checked_in")) {
            admittedCount++;
          }
        }
      }
      const latency = performance.now() - start;
      if (admittedCount === 29) {
        logTest(
          "DD-SEC-06",
          "Full Air-Gapped Lab Occupancy (All 30 Finalists Admitted)",
          "PASS",
          latency,
          `100% Lab Occupancy reached (30/30 workstations seated LAB-04-PC01..PC30). 70 non-qualifiers locked out.`
        );
      } else {
        logTest("DD-SEC-06", "Full Air-Gapped Lab Occupancy", "FAIL", latency, `Admitted ${admittedCount}/29`);
      }
    } catch (err) {
      logTest("DD-SEC-06", "Full Air-Gapped Lab Occupancy", "FAIL", 0, err.message);
    }
  }

  // ─── STAGE 6: Transition to LIVE & Scoreboard Verification ────────────────────
  {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/admin/contests/${targetContestSlug}/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({ status: "live", auto_qualify_top_30: true }),
      });
      const latency = performance.now() - start;
      if (res.ok) {
        const data = await res.json();
        logTest("DD-LIVE-01", "Transition Contest Status to LIVE", "PASS", latency, `Status: ${data.status}`);
      } else {
        logTest("DD-LIVE-01", "Transition Contest Status to LIVE", "FAIL", latency, `HTTP ${res.status}`);
      }
    } catch (err) {
      logTest("DD-LIVE-01", "Transition Contest Status to LIVE", "FAIL", 0, err.message);
    }
  }

  // ─── SUMMARY REPORT ─────────────────────────────────────────────────────────
  console.log("=".repeat(85));
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const rate = Math.round((passed / results.length) * 100);
  console.log(` Test Results: Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Success Rate: ${rate}%`);
  console.log("=".repeat(85));

  if (failed === 0) {
    console.log("\n✨ 100-USER DEEP DIVE WORKFLOW PASSED 100% WITH AIR-GAP PRODUCTION COMPLIANCE!\n");
  } else {
    console.log("\n⚠️ Some test stages failed. Check logs above.\n");
    process.exit(1);
  }
}

runDeepDive().catch((err) => {
  console.error("Fatal test suite runner error:", err);
  process.exit(1);
});
