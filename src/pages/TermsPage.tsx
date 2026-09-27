/**
 * Chaos Computer Club Medi-Caps
 * medicaps.chaoscomputerclub.in
 *
 * Terms of Service — Production Legal Specification.
 * Minimalist, high-density editorial layout with accessible navigation.
 * Copyright (c) 2026 Chaos Computer Club Medi-Caps
 */

import React from "react";
import { Link } from "react-router-dom";
import { PublicNavbar } from "../components/public/PublicNavbar";
import { PublicFooter } from "../components/public/PublicFooter";
import { Scale, ArrowRight, ShieldCheck } from "lucide-react";

export function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300 selection:bg-[#CCFF00]/30 selection:text-white flex flex-col font-sans antialiased">
      <PublicNavbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Document Header */}
        <header className="border-b border-white/10 pb-8 mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] font-mono text-xs mb-4">
            <Scale className="w-3.5 h-3.5" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
            Terms of Service
          </h1>
          <p className="mt-3 text-base text-zinc-400">
            Chaos Computer Club Medi-Caps — Medi-Caps University Chapter
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
            <span>Effective Date: September 2026</span>
            <span>•</span>
            <span>Applies to: medicaps.chaoscomputerclub.in</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="space-y-10 text-[15px] leading-relaxed text-zinc-300">
          {/* Section 1 */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
              1. Purpose and Acceptance
            </h2>
            <p className="mt-3">
              These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the competitive programming,
              cybersecurity challenge, and skill assessment platform hosted at{" "}
              <span className="font-mono text-xs text-zinc-200">medicaps.chaoscomputerclub.in</span>,
              operated by Chaos Computer Club Medi-Caps (&ldquo;CCC Medi-Caps&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;).
            </p>
            <p className="mt-3">
              By accessing the platform, creating an account via email OTP, or signing in through Google OAuth,
              you agree to be bound by these Terms and our{" "}
              <Link to="/privacy" className="text-[#CCFF00] underline">
                Privacy Policy
              </Link>
              . If you do not agree, you must discontinue using the platform immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
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
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
              3. Competition Integrity &amp; Code of Conduct
            </h2>
            <p className="mt-3">
              The platform evaluates algorithmic proficiency and security problem-solving. To maintain institutional
              standards and fair evaluation, participants must adhere to the following rules:
            </p>
            <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#121214] p-5">
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
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
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
              Security vulnerability research must be conducted responsibly under CCC Medi-Caps disclosure guidelines; unauthorized
              destructive exploitation will result in immediate disqualification and academic reporting.
            </p>
          </section>

          {/* Section 5 */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
              5. Intellectual Property &amp; Submissions
            </h2>
            <p className="mt-3">
              You retain ownership of the source code and algorithms you write. By submitting solutions through the platform,
              you grant Chaos Computer Club Medi-Caps a non-exclusive, royalty-free, perpetual license to store, compile, run,
              and analyze your code solely for judging, plagiarism evaluation, and archival purposes.
            </p>
            <p className="mt-3">
              Problem statements, editorial analyses, platform source code, and branding assets remain the exclusive
              intellectual property of Chaos Computer Club Medi-Caps and respective challenge authors.
            </p>
          </section>

          {/* Section 6 */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
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
            <p className="mt-3 text-sm text-zinc-400">
              Users may request deletion of their account and associated records in accordance with our{" "}
              <Link to="/data-deletion" className="text-[#CCFF00] underline">
                Data Deletion Instructions
              </Link>
              .
            </p>
          </section>

          {/* Section 7 */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
              7. Service Availability &amp; Disclaimer
            </h2>
            <p className="mt-3">
              The platform is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of
              any kind. While we strive for 99.9% uptime during contest windows, we are not liable for client-side network
              instabilities, local browser errors, or unscheduled upstream cloud interruptions.
            </p>
          </section>

          {/* Section 8 */}
          <section className="border-t border-white/10 pt-8">
            <h2 className="text-lg font-bold tracking-tight text-white font-mono">
              8. Contact &amp; Governance
            </h2>
            <p className="mt-3">
              Questions regarding these Terms, contest rules, or appeals may be directed to the Chapter Administration:
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-[#121214] p-5 text-sm text-zinc-300">
              <p className="font-bold text-white font-mono">Chaos Computer Club Medi-Caps</p>
              <p className="mt-1 text-zinc-400">Department of Computer Science and Engineering, Medi-Caps University, Indore</p>
              <p className="mt-2 font-mono text-xs text-[#CCFF00]">
                Email:{" "}
                <a
                  href="mailto:info@chaoscomputerclub.in"
                  className="underline underline-offset-4 hover:text-[#b8e600]"
                >
                  info@chaoscomputerclub.in
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default TermsPage;
