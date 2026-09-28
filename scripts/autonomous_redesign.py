#!/usr/bin/env python3
import subprocess
import sys
import time

PHASES = [
    {
        "num": 7,
        "name": "Contest Details (ContestOverviewPage.tsx)",
        "prompt": "Continue with Phase 7: Redesign Contest Details (src/pages/ContestOverviewPage.tsx) using shared UI primitives in src/components/design-system and tokens in src/styles.css. Follow DESIGN.md rules: void pitch-black surfaces (#000000), razor-thin hairline borders (border-white/8), electric lime (#CCFF00) accents, tabular numbers, snappy GPU transitions, full responsiveness. Preserve all existing contest data fetching, participant status, timer logic, registration/start actions, and problem routing. Verify with npm run build when finished."
    },
    {
        "num": 8,
        "name": "Contest Workspace & Arena (ContestArenaPage.tsx)",
        "prompt": "Continue with Phase 8: Redesign Contest Workspace & Arena (src/pages/ContestArenaPage.tsx) using shared UI primitives in src/components/design-system and tokens in src/styles.css. Follow DESIGN.md rules: split-pane Monaco IDE, tactical telemetry monitors, void surfaces (#000000), hairline borders (border-white/8), tabular numbers for timers and scores, live status badges. Preserve all contest lifecycle, testcase execution, problem switching, submission logic, and timer countdowns. Verify with npm run build when finished."
    },
    {
        "num": 9,
        "name": "Problem Statement & Assessment Workspace",
        "prompt": "Continue with Phase 9 & 10: Redesign Problem Statement panel and Editor/Testcase interface within src/pages/ContestArenaPage.tsx and src/pages/AssessmentWorkspacePage.tsx using design-system components. Follow DESIGN.md rules. Verify with npm run build when finished."
    },
    {
        "num": 11,
        "name": "Contest Summary (ContestSummaryPage.tsx)",
        "prompt": "Continue with Phase 11: Redesign Contest Summary (src/pages/ContestSummaryPage.tsx) using design-system components and DESIGN.md tokens. Preserve score breakdown, submission breakdown, and review flow. Verify with npm run build when finished."
    },
    {
        "num": 12,
        "name": "Results & Leaderboard (LeaderboardPage.tsx, ContestResultsPage.tsx)",
        "prompt": "Continue with Phase 12: Redesign Results & University Leaderboard (src/pages/LeaderboardPage.tsx and src/pages/ContestResultsPage.tsx) using design-system components, dense tables, tabular numerals, and lime badges. Verify with npm run build when finished."
    },
    {
        "num": 13,
        "name": "Profile & Settings (ProfilePage.tsx, SettingsPage.tsx)",
        "prompt": "Continue with Phase 13: Redesign Profile & Settings pages (src/pages/ProfilePage.tsx and src/pages/SettingsPage.tsx) using design-system components, forms, and cards. Verify with npm run build when finished."
    },
    {
        "num": 15,
        "name": "Responsive and Accessibility Pass",
        "prompt": "Continue with Phase 15: Responsive and accessibility pass across all redesigned pages. Ensure hit targets >= 44px on mobile, focus visible rings ring-2 ring-lime-400, overscroll contain, and WCAG AA contrast. Verify with npm run build when finished."
    },
    {
        "num": 16,
        "name": "Final Consistency and Regression Pass",
        "prompt": "Continue with Phase 16: Final consistency and regression pass. Ensure 0 console errors, 0 broken imports, and verify that npm run build passes cleanly."
    }
]

def run_cmd(cmd, check=True):
    print(f"\n[EXEC] {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if res.stdout:
        print(res.stdout)
    if res.stderr:
        print(res.stderr, file=sys.stderr)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed with code {res.returncode}")
    return res

def main():
    print("=" * 60)
    print("STARTING AUTONOMOUS REDESIGN PIPELINE (PHASES 7 - 16)")
    print("=" * 60)

    for phase in PHASES:
        num = phase["num"]
        name = phase["name"]
        prompt = phase["prompt"]

        print(f"\n>>> [PHASE {num}] Starting: {name} <<<")
        start_time = time.time()

        # Run OpenCode for this phase
        run_res = subprocess.run(
            ["opencode", "run", "--auto", prompt],
            capture_output=True,
            text=True
        )
        print(run_res.stdout)
        if run_res.stderr:
            print(run_res.stderr, file=sys.stderr)

        # Verify build
        print(f"\n>>> [PHASE {num}] Validating build with npm run build...")
        build_res = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
        if build_res.returncode != 0:
            print(f"Build failed after Phase {num}:")
            print(build_res.stderr or build_res.stdout)
            print("Requesting agent to fix build errors...")
            fix_prompt = f"Fix any build errors caused by Phase {num} redesign so that npm run build succeeds cleanly."
            subprocess.run(["opencode", "run", "--auto", fix_prompt])
            build_res = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)

        print(f">>> [PHASE {num}] Build check: {'PASS' if build_res.returncode == 0 else 'FAIL'}")

        # Commit changes for this phase
        status_res = subprocess.run(["git", "status", "-s"], capture_output=True, text=True)
        if status_res.stdout.strip():
            print(f">>> [PHASE {num}] Committing changes...")
            subprocess.run(["git", "add", "-A"])
            subprocess.run(["git", "commit", "-m", f"feat(ai): complete Phase {num} - {name}"])
            print(f">>> [PHASE {num}] Changes committed to feature/ai-redesign.")

        elapsed = time.time() - start_time
        print(f">>> [PHASE {num}] Completed in {elapsed:.1f}s <<<\n")

    print("=" * 60)
    print("ALL REDESIGN PHASES (7 - 16) AUTONOMOUSLY COMPLETED!")
    print("=" * 60)

if __name__ == "__main__":
    main()
