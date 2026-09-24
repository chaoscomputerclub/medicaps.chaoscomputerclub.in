/**
 * Chaos Computer Club India
 * Terms of Service — Production Specification.
 * Minimalist, high-density editorial layout without navigation or decorative graphics.
 * Copyright (c) 2026 Chaos Computer Club India
 */

import React from "react";
import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <main className="min-h-screen w-full bg-black text-zinc-300 antialiased selection:bg-[#CCFF00]/30 selection:text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        {/* Centered Application Logo */}
        <div className="flex justify-center mb-10">
          <Link
            to="/"
            className="inline-flex transition-opacity hover:opacity-80"
            aria-label="Chaos Computer Club Home"
          >
            <img
              src="/logo.webp"
              alt="Chaos Computer Club"
              className="h-11 w-11 object-contain"
            />
          </Link>
        </div>

        {/* Document Header */}
        <header className="border-b border-white/[0.08] pb-8 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Chaos Computer Club India — Platform Standards &amp; Member Agreement
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
            <span>Effective Date: September 2026</span>
            <span>•</span>
            <span>Applies to all Chaos Computer Club services</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="mt-10 space-y-12 text-[15px] leading-relaxed text-zinc-300">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              1. Purpose and Acceptance
            </h2>
            <p className="mt-3">
              These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of all software, competitive programming
              arenas, cybersecurity challenges, and community infrastructure operated by{" "}
              <strong className="font-medium text-white">Chaos Computer Club India</strong> (&ldquo;CCC&rdquo;, &ldquo;the Club&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;).
            </p>
            <p className="mt-3">
              By accessing our platform, authenticating an account, submitting code, or participating in club events,
              you agree to adhere to these Terms and uphold the Hacker Ethic. If you do not agree, you must discontinue
              use of our services immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              2. The Hacker Ethic &amp; Community Principles
            </h2>
            <p className="mt-3">
              Chaos Computer Club is rooted in curiosity, technological autonomy, and constructive exploration. Every member
              and participant commits to the fundamental tenets of the Hacker Ethic:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">The Hands-On Imperative:</strong> Access to computers and tools that teach
                how the world works should be open, experiential, and unrestricted.
              </li>
              <li>
                <strong className="text-zinc-200">Meritocracy of Skill:</strong> Hackers and engineers are evaluated solely by
                their craft, insight, and problem-solving ability — never by age, background, credentials, or status.
              </li>
              <li>
                <strong className="text-zinc-200">Information Freedom &amp; Privacy:</strong> Public data should be transparent
                and accessible; personal and private data must always be fiercely protected.
              </li>
              <li>
                <strong className="text-zinc-200">Constructive Creation:</strong> Computing is a medium for art, beauty,
                and societal empowerment. We create, optimize, and share.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              3. Member Accounts &amp; Authentication
            </h2>
            <p className="mt-3">
              To participate in rated contests, track telemetry, and access engineering challenges, you must authenticate through
              an authorized credential provider.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Identity Integrity:</strong> Each participant is permitted exactly one
                account. Multi-accounting, bot registration, and Sybil manipulations to distort rankings or ratings are strictly prohibited.
              </li>
              <li>
                <strong className="text-zinc-200">Credential Safeguarding:</strong> You are responsible for preserving the
                confidentiality of your authentication sessions and tokens. You may not share, sell, or delegate access to your account.
              </li>
              <li>
                <strong className="text-zinc-200">Accurate Handles:</strong> Member handles must not be deceptive, impersonate
                others, or infringe upon trademarks. Offensive or abusive handles will be renamed or suspended.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              4. Arena Integrity &amp; Fair Play
            </h2>
            <p className="mt-3">
              Our competitive arena is designed to measure genuine problem-solving ability. To maintain fairness across the community:
            </p>
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#121214] p-5">
              <h3 className="text-sm font-medium text-white">Strictly Prohibited During Contests:</h3>
              <ul className="mt-2.5 list-inside list-disc space-y-2 text-xs leading-normal text-zinc-400">
                <li>
                  <strong className="text-zinc-300">Collusion:</strong> Sharing source code, solution approaches, or hints
                  with other contestants while a challenge window is active.
                </li>
                <li>
                  <strong className="text-zinc-300">Unauthorized AI Assistance:</strong> Using generative AI agents, copilots,
                  or automated code generators during restricted evaluation rounds unless explicitly permitted by challenge rules.
                </li>
                <li>
                  <strong className="text-zinc-300">Queue Flooding:</strong> Launching automated rapid-fire submissions designed
                  to overwhelm the compilation engine or degrade service for other members.
                </li>
                <li>
                  <strong className="text-zinc-300">Plagiarism:</strong> Submitting pre-existing third-party code without
                  independent authorship or proper attribution when permitted.
                </li>
              </ul>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Submissions undergo automated syntactic similarity checks, execution telemetry auditing, and peer verification.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              5. Automated Code Execution &amp; Sandbox Security
            </h2>
            <p className="mt-3">
              User code is compiled and evaluated in ephemeral, isolated sandboxes. Respect for infrastructure is a core club standard:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>Do not attempt to escape containerized environments, cgroups, or kernel namespaces.</li>
              <li>Do not spawn malicious background threads, fork bombs, or cryptocurrency miners.</li>
              <li>Do not open unauthorized outbound network connections from within sandbox runners.</li>
              <li>Do not attempt to tamper with or exfiltrate test cases, test runners, or backend configurations.</li>
            </ul>
            <p className="mt-3 text-sm text-zinc-400">
              Responsible security research is welcomed. If you identify an infrastructure vulnerability, report it privately
              under our Responsible Disclosure policy rather than exploiting it destructively.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              6. Intellectual Property &amp; Open Source
            </h2>
            <p className="mt-3">
              You retain full ownership of the original algorithms and source code you author and submit to the platform.
              By submitting solutions, you grant the Club a non-exclusive, worldwide, royalty-free license to execute, compile,
              and analyze your submissions for judging, plagiarism verification, and archival leaderboards.
            </p>
            <p className="mt-3">
              Problem statements, challenge designs, benchmark suites, platform code, and Chaos Computer Club branding remain
              the property of the Club and respective authors, governed by their respective open-source or creative licenses.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              7. Disciplinary Actions &amp; Account Status
            </h2>
            <p className="mt-3">
              To preserve a healthy technical community, the Club reserves the right to take proportionate corrective actions
              for policy violations, including:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-zinc-400">
              <li>Disqualification from active contests or hackathons.</li>
              <li>Rating penalties, rollbacks, or leaderboard exclusion.</li>
              <li>Temporary or permanent revocation of platform access.</li>
              <li>Termination of Chaos Computer Club membership standing.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              8. Service Availability &amp; Disclaimers
            </h2>
            <p className="mt-3">
              Club infrastructure is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. While we strive
              for resilient, high-performance service during events, Chaos Computer Club India makes no express warranties
              regarding uninterrupted operation, zero latency, or third-party upstream connectivity.
            </p>
          </section>

          {/* Section 9 */}
          <section className="border-t border-white/[0.08] pt-8">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              9. Governance &amp; Contact
            </h2>
            <p className="mt-3">
              These Terms are administered by the core technical committee of Chaos Computer Club India. For questions,
              disputes, appeals, or responsible disclosures, reach out through official club channels:
            </p>
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#121214] p-5 text-sm text-zinc-300">
              <p className="font-medium text-white">Chaos Computer Club India</p>
              <p className="mt-1 text-zinc-400">Technical Steering Committee &amp; Core Operations</p>
              <p className="mt-2 font-mono text-xs text-lime-400">
                Email: info@chaoscomputerclub.in
              </p>
            </div>
          </section>
        </div>

        {/* Minimal Bottom Return Action */}
        <footer className="mt-16 border-t border-white/[0.08] pt-8 text-center sm:text-left">
          <Link
            to="/auth"
            className="inline-flex text-xs text-zinc-400 transition-colors hover:text-white"
          >
            ← Back to Sign In
          </Link>
        </footer>
      </div>
    </main>
  );
}

export default TermsPage;
