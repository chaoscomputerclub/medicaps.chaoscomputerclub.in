/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Terms of Service — Production Legal Specification.
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
            Chaos Computer Club India — Medi-Caps University Chapter
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
            <span>Effective Date: September 2026</span>
            <span>•</span>
            <span>Applies to: medicaps.chaoscomputerclub.in</span>
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
              These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the competitive programming,
              cybersecurity challenge, and skill assessment platform hosted at{" "}
              <span className="font-mono text-xs text-zinc-200">medicaps.chaoscomputerclub.in</span>,
              operated by Chaos Computer Club India (&ldquo;CCC&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;).
            </p>
            <p className="mt-3">
              By accessing the platform, creating an account via email OTP, or signing in through Google OAuth,
              you agree to be bound by these Terms. If you do not agree, you must discontinue using the platform immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              2. Eligibility &amp; Organization Scope
            </h2>
            <p className="mt-3">
              Access to official competitions, ratings, leaderboards, and qualified arena rounds is strictly restricted
              to enrolled students, faculty, and authorized proctors of{" "}
              <strong className="font-medium text-white">Medi-Caps University, Indore</strong>.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Organization Email:</strong> Account registration and OAuth
                authentication require a verified university email address ending in{" "}
                <span className="font-mono text-xs text-zinc-200">@medicaps.ac.in</span>.
              </li>
              <li>
                <strong className="text-zinc-200">Single Account Policy:</strong> Each student is permitted exactly
                one individual account associated with their unique Enrollment Number / PRN.
              </li>
              <li>
                <strong className="text-zinc-200">Account Security:</strong> You are responsible for safeguarding your
                authentication sessions. Impersonating another student or sharing credentials is strictly prohibited.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              3. Competition Integrity &amp; Code of Conduct
            </h2>
            <p className="mt-3">
              The platform evaluates algorithmic proficiency and security problem-solving. To maintain institutional
              standards and fair evaluation, participants must adhere to the following rules:
            </p>
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#121214] p-5">
              <h3 className="text-sm font-medium text-white">Prohibited Actions:</h3>
              <ul className="mt-2.5 list-inside list-disc space-y-2 text-xs leading-normal text-zinc-400">
                <li>
                  <strong className="text-zinc-300">Collusion &amp; Plagiarism:</strong> Sharing source code, solutions,
                  or approach hints with other participants during active contest windows.
                </li>
                <li>
                  <strong className="text-zinc-300">Generative AI Assistance:</strong> Utilizing automated AI assistance,
                  copilots, or external code generators during restricted contest modes unless explicitly authorized.
                </li>
                <li>
                  <strong className="text-zinc-300">Multiple Submissions Abuse:</strong> Flooding the judge queue with
                  denial-of-service attempts or automated submission scripts.
                </li>
                <li>
                  <strong className="text-zinc-300">Sybil Attacks:</strong> Registering alternate handles to test edge
                  cases, reserve ranking slots, or manipulate rating algorithms.
                </li>
              </ul>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              All submissions are subject to automated similarity detection algorithms and post-contest telemetry audits.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              4. Code Execution &amp; Sandbox Security
            </h2>
            <p className="mt-3">
              Code submitted through the Monaco Web IDE is compiled and executed within isolated, resource-constrained
              container sandboxes. You expressly agree not to:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>Attempt to escape or probe containerized namespaces, cgroups, or virtual file systems.</li>
              <li>Spawn background daemons, fork bombs, or cryptomining processes.</li>
              <li>Initiate unauthorized outbound network connections from inside the judge execution runtime.</li>
              <li>Exfiltrate test cases, judge binaries, or system environment configurations.</li>
            </ul>
            <p className="mt-3 text-sm text-zinc-400">
              Security vulnerability research must be conducted responsibly under CCC disclosure guidelines; unauthorized
              destructive exploitation will result in immediate disqualification and academic reporting.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              5. Intellectual Property &amp; Submissions
            </h2>
            <p className="mt-3">
              You retain ownership of the source code and algorithms you write. By submitting solutions through the platform,
              you grant Chaos Computer Club India a non-exclusive, royalty-free, perpetual license to store, compile, run,
              and analyze your code solely for judging, plagiarism evaluation, and archival purposes.
            </p>
            <p className="mt-3">
              Problem statements, editorial analyses, platform source code, and branding assets remain the exclusive
              intellectual property of Chaos Computer Club India and respective challenge authors.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              6. Disciplinary Enforcement &amp; Termination
            </h2>
            <p className="mt-3">
              We reserve the right to investigate suspicious activity and take immediate corrective measures at our sole
              discretion, including:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-zinc-400">
              <li>Disqualification from current and upcoming competitive contests.</li>
              <li>Rating resets or permanent exclusion from leaderboard indices.</li>
              <li>Revocation of platform authentication tokens and account suspension.</li>
              <li>Referral to the university academic disciplinary committee for ethical violations.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              7. Service Availability &amp; Disclaimer
            </h2>
            <p className="mt-3">
              The platform is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of
              any kind. While we strive for 99.9% uptime during contest windows, we are not liable for client-side network
              instabilities, local browser errors, or unscheduled upstream cloud interruptions.
            </p>
          </section>

          {/* Section 8 */}
          <section className="border-t border-white/[0.08] pt-8">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              8. Contact &amp; Governance
            </h2>
            <p className="mt-3">
              Questions regarding these Terms, contest rules, or appeals may be directed to the Chapter Administration:
            </p>
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#121214] p-5 text-sm text-zinc-300">
              <p className="font-medium text-white">Chaos Computer Club India — Medi-Caps Chapter</p>
              <p className="mt-1 text-zinc-400">Faculty Coordinator &amp; Student Technical Lead</p>
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
