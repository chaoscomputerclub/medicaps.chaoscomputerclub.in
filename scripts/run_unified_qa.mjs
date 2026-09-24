#!/usr/bin/env node

/**
 * Unified QA Automation Master Suite
 * Chaos Computer Club — Medi-Caps Chapter
 *
 * Orchestrates:
 *  1. TypeScript Compilation Integrity (tsc --noEmit)
 *  2. Production Web Bundle Build (npm run build)
 *  3. Dynamic API Contract & RBAC Boundary Fuzzing
 *  4. Full Application Frontend-to-Backend Simulation
 *  5. Playwright E2E, Dead-UI & Accessibility Audits
 *  6. 300-Element Interactive UI Backend Connectivity Audit
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const steps = [
  { name: 'TypeScript Static Type Check', command: 'npx', args: ['tsc', '--noEmit'] },
  { name: 'Production Frontend Build', command: 'npm', args: ['run', 'build'] },
  { name: 'Dynamic API Contract & RBAC Fuzzer', command: 'node', args: ['scripts/api_contract_fuzzer.mjs'] },
  { name: 'Full Application QA Simulation', command: 'node', args: ['scripts/qa_full_application.mjs'] },
  { name: 'Playwright E2E & Dead-UI Audits', command: 'npx', args: ['playwright', 'test'] },
  { name: 'UI Elements Backend Connectivity Audit', command: 'node', args: ['scripts/audit_ui_elements_backend_connectivity.mjs'] },
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log('\n' + '='.repeat(80));
    console.log(` 🚀 RUNNING STAGE: ${step.name}`);
    console.log(` Command: ${step.command} ${step.args.join(' ')}`);
    console.log('='.repeat(80));

    const startTime = performance.now();
    const proc = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    });

    proc.on('close', (code) => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`✅ [PASSED] ${step.name} (${elapsed}s)`);
        resolve();
      } else {
        console.error(`❌ [FAILED] ${step.name} exited with code ${code} (${elapsed}s)`);
        reject(new Error(`Stage ${step.name} failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function runAll() {
  console.log('='.repeat(80));
  console.log(' 🛡️  STARTING CCC UNIFIED AUTONOMOUS QA TEST PLATFORM');
  console.log('='.repeat(80));

  const suiteStart = performance.now();

  for (const step of steps) {
    try {
      await runStep(step);
    } catch (err) {
      console.error('\n' + '!'.repeat(80));
      console.error(` 🛑 QA PIPELINE HALTED AT: ${step.name}`);
      console.error(` Error: ${err.message}`);
      console.error('!'.repeat(80));
      process.exit(1);
    }
  }

  const totalTime = ((performance.now() - suiteStart) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(80));
  console.log(` ✨ ALL QA VALIDATION GATES PASSED CLEANLY (${totalTime}s)`);
  console.log('    100% PRODUCTION COMPLIANT & READY FOR DEPLOYMENT');
  console.log('='.repeat(80) + '\n');
}

runAll();
