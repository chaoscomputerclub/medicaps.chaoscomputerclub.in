/**
 * Chaos Computer Club — Global Arena
 * chaoscomputerclub.in
 *
 * Terms of Service — Production Legal Specification.
 * Minimalist, high-density editorial layout without navigation or decorative graphics.
 * Copyright (c) 2026 Chaos Computer Club India
 */

import React from "react";
import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <main className="min-h-screen w-full bg-[#171717] text-zinc-300 antialiased selection:bg-[#B1FA63]/30 selection:text-white font-sans">
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
          <h1 className="text-3xl font-heading font-bold tracking-tight text-white sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Chaos Computer Club — Global Arena Platform
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
            <span>Effective Date: November 2026</span>
            <span>•</span>
            <span>Applies globally: chaoscomputerclub.in</span>
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
              These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the competitive programming arena,
              cybersecurity challenge infrastructure, AI technical interview simulations, and developer assessment platform hosted at{" "}
              <span className="font-sans text-xs text-zinc-200">chaoscomputerclub.in</span> (and authorized regional endpoints),
              operated by Chaos Computer Club (&ldquo;CCC&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;).
            </p>
            <p className="mt-3">
              By accessing the platform, creating an account via email verification, signing in through Google OAuth,
              or executing code against our automated judging engines, you agree to be bound by these Terms. If you do not
              agree, you must discontinue using the platform immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              2. Eligibility &amp; Global Account Scope
            </h2>
            <p className="mt-3">
              The platform is open globally to all software engineers, university students, researchers, and technology
              practitioners. Access to public practice problems, algorithmic arenas, ratings, and open tournaments is not
              restricted by geographical borders or institutional enrollment.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Universal Authentication:</strong> Account registration supports personal,
                academic, and corporate email addresses. Verified email ownership is required for all contest registrations.
              </li>
              <li>
                <strong className="text-zinc-200">Single Identity Rule:</strong> Each participant is permitted exactly
                one individual account on the platform. Operating multiple handles (&ldquo;smurfing&rdquo; or &ldquo;Sybil accounts&rdquo;)
                to bypass rating boundaries, manipulate contest divisions, or harvest challenge sets is strictly forbidden.
              </li>
              <li>
                <strong className="text-zinc-200">Account Security:</strong> You are responsible for safeguarding your
                credentials, authentication tokens, and session integrity. Transferring accounts or sharing login keys is prohibited.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              3. Organization Workspaces &amp; Multi-Tenancy
            </h2>
            <p className="mt-3">
              Educational institutions, enterprise engineering departments, coding clubs, and hackathon organizers may
              maintain specialized organization workspaces on the platform.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Workspace Independence:</strong> An individual user account exists
                independently of any organization. Joining an organization workspace grants access to that organization&rsquo;s
                private challenges and custom problem sets without relinquishing global account ownership or personal ratings.
              </li>
              <li>
                <strong className="text-zinc-200">Coordinator Responsibilities:</strong> Organization administrators and proctors
                are responsible for managing internal memberships, configuring private contest rules, and upholding ethical testing standards.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              4. Competition Integrity &amp; Code of Conduct
            </h2>
            <p className="mt-3">
              The platform evaluates algorithmic proficiency and security problem-solving. To maintain global
              standards and fair evaluation, participants must adhere strictly to fair play guidelines:
            </p>
            <div className="mt-4 rounded-[16px] border border-white/[0.08] bg-[#171717] p-5 sm:p-6">
              <h3 className="text-sm font-medium text-white">Prohibited Actions:</h3>
              <ul className="mt-2.5 list-inside list-disc space-y-2 text-xs leading-normal text-zinc-400">
                <li>
                  <strong className="text-zinc-300">Collusion &amp; Plagiarism:</strong> Sharing source code, solutions,
                  or approach hints with other participants during active contest windows.
                </li>
                <li>
                  <strong className="text-zinc-300">Generative AI Assistance:</strong> Utilizing automated AI copilots,
                  large language models, or external code generators during restricted rated rounds unless explicitly authorized.
                </li>
                <li>
                  <strong className="text-zinc-300">Multiple Submissions Abuse:</strong> Flooding the judge queue with
                  denial-of-service attempts, fork bombs, or automated submission scripts.
                </li>
                <li>
                  <strong className="text-zinc-300">Sybil Attacks:</strong> Registering alternate handles to probe hidden
                  test cases, reserve leaderboard slots, or distort Elo rating algorithms.
                </li>
              </ul>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              All submissions are subject to automated abstract syntax tree (AST) similarity detection algorithms and post-contest
              telemetry audits. Decisions of the Chief Proctor and Contest Jury regarding disqualifications are final.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              5. Code Execution &amp; Sandbox Security
            </h2>
            <p className="mt-3">
              Code submitted through the Monaco Web IDE is compiled and executed within isolated, resource-constrained
              Linux namespaces, cgroups v2, and seccomp-bpf container sandboxes. You expressly agree not to:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
              <li>Attempt to escape or probe containerized namespaces, cgroups, or virtual file systems.</li>
              <li>Spawn background daemons, fork bombs, or cryptomining processes.</li>
              <li>Initiate unauthorized outbound network connections from inside the judge execution runtime.</li>
              <li>Exfiltrate hidden test cases, judge binaries, or system environment configurations.</li>
            </ul>
            <p className="mt-3 text-sm text-zinc-400">
              Security vulnerability research must be conducted responsibly under CCC disclosure guidelines; unauthorized
              destructive exploitation will result in immediate disqualification and account suspension.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              6. AI Technical Interview Arena &amp; Telemetry
            </h2>
            <p className="mt-3">
              The platform provides adaptive AI-driven technical interview simulations featuring interactive voice dialogue,
              real-time algorithmic challenges, and multi-dimensional rubric scoring.
            </p>
            <p className="mt-3">
              By initiating an AI interview, you consent to the processing of your audio stream, live code modifications,
              and problem-solving transcripts solely to generate performance evaluation reports and coaching dossiers.
              Detailed candidate dossiers remain strictly private to your account unless you explicitly choose to export or share them.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              7. Intellectual Property &amp; Submissions
            </h2>
            <p className="mt-3">
              You retain full ownership and copyright of the original source code and algorithmic implementations you write.
              By submitting solutions through the platform, you grant Chaos Computer Club a non-exclusive, worldwide,
              royalty-free license to store, compile, run, benchmark, and analyze your code solely for judging, plagiarism evaluation,
              and leaderboard ranking.
            </p>
            <p className="mt-3">
              Problem statements, editorial analyses, testcase suites, platform source code, Mako mascot assets, and branding
              elements remain the exclusive intellectual property of Chaos Computer Club and respective challenge authors.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              8. Disciplinary Enforcement &amp; Termination
            </h2>
            <p className="mt-3">
              We reserve the right to investigate suspicious activity and take immediate corrective measures at our sole
              discretion, including:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-zinc-400">
              <li>Disqualification from current and upcoming competitive contests.</li>
              <li>Elo rating resets or permanent exclusion from global leaderboard indices.</li>
              <li>Revocation of platform authentication tokens and account suspension.</li>
              <li>Permanent forfeiture of earned credentials and tournament qualification passes.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              9. Service Availability &amp; Disclaimer
            </h2>
            <p className="mt-3">
              The platform is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of
              any kind. While we strive for high uptime during competitive contest windows, we are not liable for client-side
              network instabilities, local browser errors, or unscheduled upstream cloud interruptions.
            </p>
          </section>

          {/* Section 10 */}
          <section className="border-t border-white/[0.08] pt-8">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              10. Contact &amp; Governance
            </h2>
            <p className="mt-3">
              Questions regarding these Terms, contest rules, or appeals may be directed to Platform Governance:
            </p>
            <div className="mt-4 rounded-[16px] border border-white/[0.08] bg-[#171717] p-5 sm:p-6 text-sm text-zinc-300">
              <p className="font-medium text-white">Chaos Computer Club — Global Arena</p>
              <p className="mt-1 text-zinc-400">Global Engineering Collective &amp; Platform Administration</p>
              <p className="mt-2 font-sans text-xs text-lime-400">
                Email:{" "}
                <a
                  href={`mailto:${(import.meta.env["VITE_CONTACT_EMAIL"] as string) || "legal@chaoscomputerclub.in"}`}
                  className="underline underline-offset-4 transition-colors hover:text-lime-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400"
                >
                  {(import.meta.env["VITE_CONTACT_EMAIL"] as string) || "legal@chaoscomputerclub.in"}
                </a>
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
