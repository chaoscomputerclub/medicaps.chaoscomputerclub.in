/**
 * Chaos Computer Club Medi-Caps
 * src/pages/PrivacyPage.tsx — Public Privacy Policy Specification
 * Fully compliant with Google OAuth API Verification & Google API Services User Data Policy.
 */

import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, ExternalLink, Mail, MapPin } from "lucide-react";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300 antialiased selection:bg-lime-400 selection:text-black flex flex-col">
      <PublicNavbar />

      <main className="flex-1 py-12 sm:py-20">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <header className="border-b border-white/[0.08] pb-8 space-y-3">
            <div className="inline-flex items-center gap-2 rounded bg-lime-400/10 border border-lime-400/20 px-2.5 py-1 text-xs font-mono text-lime-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>LEGAL COMPLIANCE &bull; GOOGLE OAUTH SPECIFICATION</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="text-sm text-zinc-400 font-sans">
              <strong className="text-white">Chaos Computer Club Medi-Caps</strong> &bull; Medi-Caps University Chapter
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 font-mono">
              <span>Effective Date: September 27, 2026</span>
              <span>&bull;</span>
              <span>Applies to: https://medicaps.chaoscomputerclub.in</span>
            </div>
          </header>

          {/* Prominent Google Limited Use Callout */}
          <div className="rounded-lg border border-lime-400/30 bg-lime-950/20 p-5 space-y-2">
            <div className="flex items-center gap-2 text-lime-400 font-mono text-xs font-bold uppercase tracking-wider">
              <Lock className="h-4 w-4" />
              <span>Google API Services User Data Policy Compliance</span>
            </div>
            <p className="text-xs text-zinc-200 leading-relaxed">
              Chaos Computer Club Medi-Caps&apos; use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-400 underline hover:text-lime-300 inline-flex items-center gap-0.5"
              >
                <span>Google API Services User Data Policy</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              , including the Limited Use requirements.
            </p>
          </div>

          {/* ── SECTION 1: INTRODUCTION ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              1. Introduction
            </h2>
            <p className="text-sm leading-relaxed">
              Welcome to <strong className="text-white">Chaos Computer Club Medi-Caps</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;, or the &ldquo;Platform&rdquo;), hosted at{" "}
              <code className="text-xs font-mono text-lime-400 bg-white/5 px-1 py-0.5 rounded">https://medicaps.chaoscomputerclub.in</code>.
              This Privacy Policy explains transparently how we collect, access, process, store, protect, and delete user information, with particular emphasis on Google OAuth user data accessed during institutional single sign-on.
            </p>
          </section>

          {/* ── SECTION 2: WHO WE ARE ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              2. Who We Are
            </h2>
            <p className="text-sm leading-relaxed">
              Chaos Computer Club Medi-Caps is the official competitive programming and cybersecurity chapter operating within the Department of Computer Science &amp; Engineering at <strong className="text-white">Medi-Caps University</strong>, located on AB Road, Pigdamber, Rau, Indore, Madhya Pradesh 453331, India.
            </p>
            <p className="text-sm leading-relaxed">
              The platform facilitates proctored programming contests, air-gapped code sandbox execution (CodeBox), mathematical Elo rating calculations, and verified student competition records for enrolled university students and faculty.
            </p>
          </section>

          {/* ── SECTION 3: INFORMATION WE COLLECT ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              3. Information We Collect
            </h2>
            <p className="text-sm leading-relaxed">
              We collect information in three distinct categories:
            </p>
            <div className="space-y-3 text-sm">
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <strong className="text-white block font-mono text-xs text-lime-400">A. Information You Provide Directly</strong>
                <p className="text-xs text-zinc-300 mt-1">During onboarding or profile customization: competitive handle, academic department, graduating batch year, and student enrollment number (PRN).</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <strong className="text-white block font-mono text-xs text-lime-400">B. Information From Google OAuth</strong>
                <p className="text-xs text-zinc-300 mt-1">When signing in via your university Google Workspace account: Google subject identifier, verified institutional email address, full name, and avatar image URL.</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <strong className="text-white block font-mono text-xs text-lime-400">C. Contest &amp; Execution Telemetry</strong>
                <p className="text-xs text-zinc-300 mt-1">Source code submitted to the CodeBox sandbox, execution runtimes, memory consumption, testcase verdicts, contest check-in timestamps, and Elo rating history.</p>
              </div>
            </div>
          </section>

          {/* ── SECTION 4: GOOGLE USER DATA WE ACCESS ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              4. Google User Data We Access
            </h2>
            <p className="text-sm leading-relaxed">
              When you choose to authenticate via Google OAuth 2.0, our server exchanges your temporary authorization code for user profile metadata strictly from the official endpoint (<code className="text-xs font-mono text-zinc-300">https://www.googleapis.com/oauth2/v2/userinfo</code>).
            </p>
            <p className="text-sm leading-relaxed">
              We access <strong className="text-white">only the following specific fields</strong>:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-zinc-300 pl-2">
              <li>
                <strong className="text-white">Google Unique Identifier (<code className="font-mono text-xs text-lime-400">id</code> / <code className="font-mono text-xs text-lime-400">sub</code>)</strong>: An alphanumeric string uniquely identifying your Google account.
              </li>
              <li>
                <strong className="text-white">Institutional Email Address (<code className="font-mono text-xs text-lime-400">email</code>)</strong>: Your verified university email address (which must end with <code className="font-mono text-xs text-lime-400">@medicaps.ac.in</code>).
              </li>
              <li>
                <strong className="text-white">Full Name (<code className="font-mono text-xs text-lime-400">name</code>)</strong>: Your name as registered in the university Google Workspace directory.
              </li>
              <li>
                <strong className="text-white">Profile Picture URL (<code className="font-mono text-xs text-lime-400">picture</code>)</strong>: The URL of your Google profile picture (hosted on Google&apos;s servers).
              </li>
            </ul>
            <div className="p-4 rounded-md border border-white/10 bg-zinc-950 text-xs text-zinc-400 leading-relaxed">
              <strong className="text-white font-mono block mb-1">What We DO NOT Access:</strong>
              Our application does <strong className="text-white">NOT</strong> request, access, read, or store your Google Drive files, Gmail messages, Google Contacts, Google Calendar events, Google Docs, or any other Google Workspace service data. We do <strong className="text-white">NOT</strong> access your Google account password.
            </div>
          </section>

          {/* ── SECTION 5: GOOGLE OAUTH SCOPES ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              5. Google OAuth Scopes &amp; Feature Mapping
            </h2>
            <p className="text-sm leading-relaxed">
              In accordance with Google&apos;s principle of data minimization, Chaos Computer Club Medi-Caps requests strictly the three minimum standard OpenID Connect scopes required for identity verification:
            </p>

            {/* Scope Table */}
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900 border-b border-white/10 text-white font-mono">
                  <tr>
                    <th className="p-3">OAuth Scope</th>
                    <th className="p-3">Data Provided</th>
                    <th className="p-3">Feature &amp; Purpose</th>
                    <th className="p-3">Storage &amp; Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  <tr>
                    <td className="p-3 font-mono text-lime-400">openid</td>
                    <td className="p-3">Subject ID token validating authentication</td>
                    <td className="p-3">Confirms authentic user session under standard OpenID Connect protocol.</td>
                    <td className="p-3">Ephemeral in memory; not stored permanently.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-lime-400">.../auth/userinfo.email (email)</td>
                    <td className="p-3">Primary Google email address</td>
                    <td className="p-3">Verifies Medi-Caps University affiliation (@medicaps.ac.in) and provisions student cadet account.</td>
                    <td className="p-3">Stored in PostgreSQL user table for active account lifetime.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-lime-400">.../auth/userinfo.profile (profile)</td>
                    <td className="p-3">Display name and avatar URL</td>
                    <td className="p-3">Displays student name on contest scoreboards, certificates, and campus passes.</td>
                    <td className="p-3">Stored in PostgreSQL user table; can be customized or deleted at any time.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── SECTION 6: HOW GOOGLE USER DATA IS USED ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              6. How Google User Data Is Used
            </h2>
            <div className="space-y-3 text-sm">
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <strong className="text-white block font-mono text-xs">A. Identity Authentication &amp; Institutional Validation</strong>
                <p className="text-xs text-zinc-300 mt-1">We enforce the university domain restriction (<code className="font-mono text-lime-400">@medicaps.ac.in</code>) to verify that contestants are currently enrolled students or faculty members of Medi-Caps University.</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <strong className="text-white block font-mono text-xs">B. Cadet Account Provisioning</strong>
                <p className="text-xs text-zinc-300 mt-1">Upon first login, we extract your enrollment candidate identifier from your email prefix and create an internal student record linking your contest submissions and Elo ratings.</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <strong className="text-white block font-mono text-xs">C. Competition Scoreboards &amp; Dossiers</strong>
                <p className="text-xs text-zinc-300 mt-1">Your display name and avatar are rendered on live tournament leaderboards, university ranking matrices, and cryptographic achievement proofs.</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <strong className="text-white block font-mono text-xs">D. No Secondary Commercial Exploitation</strong>
                <p className="text-xs text-zinc-300 mt-1">We do <strong className="text-white">NOT</strong> use Google user data for advertising, marketing profiling, cross-site tracking, credit assessments, or third-party resale under any circumstance.</p>
              </div>
            </div>
          </section>

          {/* ── SECTION 7: DATA SHARING & THIRD-PARTY DISCLOSURES ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              7. Data Sharing &amp; Third Parties
            </h2>
            <p className="text-sm leading-relaxed">
              We do <strong className="text-white">NOT</strong> sell, rent, lease, or monetize your personal information or Google user data to any external parties or data brokers.
            </p>
            <p className="text-sm leading-relaxed">
              Data is transmitted solely to the underlying infrastructure services necessary to operate the application securely:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs text-zinc-300 pl-2">
              <li>
                <strong className="text-white">PostgreSQL Database Hosting (DigitalOcean Droplet)</strong>: Relational persistence for user accounts, contest registrations, and scoreboards.
              </li>
              <li>
                <strong className="text-white">Redis 7 In-Memory Cache</strong>: Ephemeral cache for session token revocation and rate limiting.
              </li>
              <li>
                <strong className="text-white">MinIO Object Storage</strong>: Storage for student-uploaded avatar files (if uploaded directly).
              </li>
              <li>
                <strong className="text-white">Hostinger SMTP Services</strong>: Delivery of essential transactional emails (e.g., login verification OTPs and contest reminder notifications).
              </li>
              <li>
                <strong className="text-white">Cloudflare Inc.</strong>: Content delivery network, SSL/TLS termination, and Cloudflare Turnstile anti-bot security protection.
              </li>
            </ul>
          </section>

          {/* ── SECTION 8: DATA STORAGE & TECHNICAL SECURITY CONTROLS ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              8. Data Storage &amp; Security Controls
            </h2>
            <p className="text-sm leading-relaxed">
              We apply defense-in-depth security controls across the entire software lifecycle:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950 space-y-1">
                <strong className="text-white font-mono block">Transport Layer Security</strong>
                <p className="text-zinc-400">All data in transit is encrypted using modern TLS 1.3 / HTTPS encryption. Insecure plaintext HTTP requests are automatically redirected.</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950 space-y-1">
                <strong className="text-white font-mono block">Cryptographic Cookies</strong>
                <p className="text-zinc-400">Session and refresh tokens are stored in HttpOnly, Secure, SameSite=Lax cookies, completely inaccessible to client-side JavaScript (mitigating XSS attack vectors).</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950 space-y-1">
                <strong className="text-white font-mono block">Asymmetric Token Signatures</strong>
                <p className="text-zinc-400">Platform session tokens are signed asymmetrically using RSA-256 (RS256) private keys and validated against a public verification key.</p>
              </div>
              <div className="p-4 rounded-md border border-white/5 bg-zinc-950 space-y-1">
                <strong className="text-white font-mono block">Ephemeral OAuth Processing</strong>
                <p className="text-zinc-400">Google OAuth access tokens are discarded immediately from memory following userinfo retrieval and are never persisted in any database or file.</p>
              </div>
            </div>
          </section>

          {/* ── SECTION 9: DATA RETENTION ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              9. Data Retention Policy
            </h2>
            <p className="text-sm leading-relaxed">
              We retain data strictly for the duration necessary to deliver the competitive programming arena services:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs text-zinc-300 pl-2">
              <li>
                <strong className="text-white">Active Member Accounts</strong>: User profile data (name, email, PRN, handle) is maintained while the cadet account remains active.
              </li>
              <li>
                <strong className="text-white">Google OAuth Access Tokens</strong>: Retained for 0 seconds (processed in-memory and discarded).
              </li>
              <li>
                <strong className="text-white">Platform Refresh Tokens</strong>: Stored in Redis with a maximum 30-day Time-To-Live (TTL), immediately revoked on logout.
              </li>
              <li>
                <strong className="text-white">Contest Submissions &amp; Leaderboards</strong>: Historical contest submissions and Elo calculations are archived for academic standing and university leaderboard records.
              </li>
              <li>
                <strong className="text-white">Authentication Audit Logs</strong>: Security audit logs are automatically rotated and purged after 90 days.
              </li>
            </ul>
          </section>

          {/* ── SECTION 10: DATA DELETION & ACCOUNT DELETION ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              10. Data Deletion &amp; Account Purge
            </h2>
            <p className="text-sm leading-relaxed">
              You possess the absolute right to delete your cadet profile and purge all associated Google user data at any time:
            </p>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-md border border-white/10 bg-zinc-950">
                <strong className="text-white text-sm block font-mono text-lime-400">Method 1: In-App Self-Service Deletion</strong>
                <p className="mt-1 text-zinc-300">
                  Signed-in cadets can navigate to <Link to="/settings" className="text-lime-400 underline">Settings</Link> &rarr; &ldquo;Danger Zone&rdquo; &rarr; &ldquo;Delete Account&rdquo;. Clicking &ldquo;Permanently Delete Account&rdquo; immediately triggers our server-side purge routine (<code className="font-mono text-zinc-300">DELETE /api/auth/me</code>).
                </p>
              </div>
              <div className="p-4 rounded-md border border-white/10 bg-zinc-950">
                <strong className="text-white text-sm block font-mono text-lime-400">Method 2: Public Data Deletion Portal</strong>
                <p className="mt-1 text-zinc-300">
                  Visit our dedicated public <Link to="/data-deletion" className="text-lime-400 underline">Data Deletion Instructions Page</Link> for detailed steps on requesting account removal even if you no longer have access to the platform.
                </p>
              </div>
              <div className="p-4 rounded-md border border-white/10 bg-zinc-950">
                <strong className="text-white text-sm block font-mono text-lime-400">Method 3: Direct Email Request</strong>
                <p className="mt-1 text-zinc-300">
                  Email us at <a href="mailto:info@chaoscomputerclub.in" className="text-lime-400 underline">info@chaoscomputerclub.in</a> from your registered Medi-Caps email with the subject &ldquo;Data Deletion Request&rdquo;. Requests are processed within 30 calendar days.
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed pt-2">
              Upon account deletion, your Google identifier, email address, custom avatar, campus passes, follow relationships, and active session tokens are permanently wiped from PostgreSQL and Redis.
            </p>
          </section>

          {/* ── SECTION 11: USER RIGHTS ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              11. User Rights
            </h2>
            <p className="text-sm leading-relaxed">
              Subject to applicable legal standards, you have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-zinc-300 pl-2">
              <li><strong className="text-white">Right of Access</strong>: You may view your profile, submitted solutions, and ratings at any time.</li>
              <li><strong className="text-white">Right to Rectification</strong>: You may update your full name, handle, and avatar in Settings.</li>
              <li><strong className="text-white">Right to Erasure</strong>: You may request complete deletion of your account and personal data.</li>
              <li><strong className="text-white">Right to Revoke Access</strong>: You may revoke the app&apos;s authorization via Google Account settings (<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-lime-400 underline inline-flex items-center gap-0.5"><span>myaccount.google.com/permissions</span><ExternalLink className="h-2.5 w-2.5" /></a>).</li>
            </ul>
          </section>

          {/* ── SECTION 12: COOKIES & SESSIONS ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              12. Cookies and Sessions
            </h2>
            <p className="text-sm leading-relaxed">
              Our application uses strictly functional cookies necessary for authentication and CSRF security:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-zinc-300 pl-2">
              <li><code className="font-mono text-lime-400">access_token</code>: Authenticated session token (HttpOnly, Secure, SameSite=Lax).</li>
              <li><code className="font-mono text-lime-400">refresh_token</code>: Secure token rotation token (HttpOnly, Secure, SameSite=Lax).</li>
              <li><code className="font-mono text-lime-400">ccc_oauth_state</code>: Temporary 10-minute CSRF prevention cookie during Google OAuth flow.</li>
            </ul>
          </section>

          {/* ── SECTION 13: CHILDREN'S PRIVACY ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              13. Children&apos;s Privacy
            </h2>
            <p className="text-sm leading-relaxed">
              Chaos Computer Club Medi-Caps is an institutional university platform restricted to enrolled university students and faculty members. We do not knowingly collect personal information from individuals under the age of 16.
            </p>
          </section>

          {/* ── SECTION 14: CHANGES TO THIS POLICY ── */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/[0.06] pb-2">
              14. Changes to This Privacy Policy
            </h2>
            <p className="text-sm leading-relaxed">
              We may update this Privacy Policy periodically to reflect technological improvements or legal requirements. Material changes will be communicated via campus portal announcements and the &ldquo;Effective Date&rdquo; header at the top of this document.
            </p>
          </section>

          {/* ── SECTION 15: CONTACT INFORMATION ── */}
          <section className="space-y-4 border-t border-white/[0.08] pt-6">
            <h2 className="text-xl font-bold text-white tracking-tight">
              15. Contact Information
            </h2>
            <div className="rounded-lg border border-white/10 bg-zinc-950 p-6 space-y-3 text-xs text-zinc-300">
              <p className="font-semibold text-white text-sm">Chaos Computer Club Medi-Caps</p>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-lime-400 shrink-0 mt-0.5" />
                <span>
                  Medi-Caps University, AB Road, Pigdamber, Rau, Indore, Madhya Pradesh 453331, India
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-lime-400 shrink-0" />
                <a href="mailto:info@chaoscomputerclub.in" className="text-lime-400 hover:underline">
                  info@chaoscomputerclub.in
                </a>
              </div>
              <p className="text-zinc-400 pt-2 text-[11px]">
                Department of Computer Science &amp; Engineering &bull; Faculty Advisor: Dr. Ratnesh Litoriya (Chief Proctor)
              </p>
            </div>
          </section>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}

export default PrivacyPage;
