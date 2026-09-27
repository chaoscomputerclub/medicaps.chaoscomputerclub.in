/**
 * scripts/prerender_static_pages.mjs
 *
 * Prerenders static, crawlable, SEO-rich HTML for public verification pages:
 * - /privacy (Google OAuth Verification & User Data Policy)
 * - /terms (Terms of Service)
 * - /data-deletion (Data Deletion Instructions)
 * - /about (About Chaos Computer Club Medi-Caps)
 * - /contact (Contact & Support Desk)
 * - / (Public Landing Homepage)
 *
 * This guarantees Google Trust & Safety automated scanners, Googlebot, and incognito
 * visitors receive 100% complete, legible legal content in the initial HTTP response
 * without requiring client-side JavaScript execution, while preserving seamless
 * React 18 hydration for interactive browser sessions.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

if (!fs.existsSync(distDir)) {
  console.error("Error: dist directory does not exist. Run 'vite build' first.");
  process.exit(1);
}

const templatePath = path.join(distDir, "index.html");
const templateHtml = fs.readFileSync(templatePath, "utf-8");

// Helper to construct standard Public Header
function renderNavbar(activePath = "") {
  return `
  <header style="border-bottom:1px solid rgba(255,255,255,0.08);background:#000000;position:sticky;top:0;z-index:50;backdrop-filter:blur(8px);">
    <div style="max-width:1200px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
      <a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:#ffffff;">
        <img src="/logo.webp" alt="Chaos Computer Club" style="width:32px;height:32px;object-fit:contain;" />
        <div style="display:flex;flex-direction:column;">
          <strong style="font-size:12px;letter-spacing:0.05em;color:#ffffff;font-family:ui-monospace,monospace;">CHAOS COMPUTER CLUB</strong>
          <span style="font-size:9px;color:#a1a1aa;letter-spacing:0.05em;font-family:ui-monospace,monospace;">MEDI-CAPS CHAPTER</span>
        </div>
      </a>
      <nav style="display:flex;align-items:center;gap:18px;font-family:ui-monospace,monospace;font-size:12px;">
        <a href="/about" style="color:${activePath === "/about" ? "#CCFF00" : "#a1a1aa"};text-decoration:none;">About</a>
        <a href="/privacy" style="color:${activePath === "/privacy" ? "#CCFF00" : "#a1a1aa"};text-decoration:none;">Privacy</a>
        <a href="/terms" style="color:${activePath === "/terms" ? "#CCFF00" : "#a1a1aa"};text-decoration:none;">Terms</a>
        <a href="/data-deletion" style="color:${activePath === "/data-deletion" ? "#CCFF00" : "#a1a1aa"};text-decoration:none;">Data Deletion</a>
        <a href="/contact" style="color:${activePath === "/contact" ? "#CCFF00" : "#a1a1aa"};text-decoration:none;">Contact</a>
        <a href="/auth" style="background:#CCFF00;color:#000000;padding:6px 12px;border-radius:6px;font-weight:700;text-decoration:none;">Sign In</a>
      </nav>
    </div>
  </header>
  `;
}

// Helper to construct standard Public Footer
function renderFooter() {
  return `
  <footer style="border-top:1px solid rgba(255,255,255,0.08);background:#09090b;padding:36px 16px;font-family:ui-monospace,monospace;font-size:12px;color:#71717a;margin-top:auto;">
    <div style="max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px;">
      <div>
        <div style="color:#ffffff;font-weight:700;font-size:13px;margin-bottom:6px;">Chaos Computer Club Medi-Caps</div>
        <div>Department of Computer Science &amp; Engineering</div>
        <div>Medi-Caps University, A.B. Road, Pigdamber, Rau, Indore, MP 453331, India</div>
        <div style="margin-top:8px;color:#a1a1aa;">Email: <a href="mailto:info@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:none;">info@chaoscomputerclub.in</a> | <a href="mailto:privacy@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:none;">privacy@chaoscomputerclub.in</a></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <span style="color:#ffffff;font-weight:700;">Legal &amp; Policy Disclosures</span>
        <a href="/privacy" style="color:#a1a1aa;text-decoration:none;">Privacy Policy (Google User Data)</a>
        <a href="/terms" style="color:#a1a1aa;text-decoration:none;">Terms of Service</a>
        <a href="/data-deletion" style="color:#a1a1aa;text-decoration:none;">Data Deletion Instructions</a>
        <a href="/about" style="color:#a1a1aa;text-decoration:none;">About Chapter</a>
        <a href="/contact" style="color:#a1a1aa;text-decoration:none;">Contact Desk</a>
      </div>
    </div>
    <div style="max-width:1200px;margin:24px auto 0;padding-top:16px;border-top:1px solid rgba(255,255,255,0.04);font-size:11px;color:#52525b;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;">
      <div>&copy; 2026 Chaos Computer Club Medi-Caps. All rights reserved. Medi-Caps University, Indore.</div>
      <div>Google API Services User Data Policy &bull; Limited Use Compliance Verified</div>
    </div>
  </footer>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE CONTENTS
// ─────────────────────────────────────────────────────────────────────────────

const privacyContent = `
<div style="min-height:100vh;background:#000000;color:#d4d4d8;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  ${renderNavbar("/privacy")}

  <main style="flex:1;max-width:860px;margin:0 auto;padding:40px 20px 80px;line-height:1.65;font-size:14px;">
    <!-- Title Section -->
    <header style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:24px;margin-bottom:32px;">
      <div style="display:inline-block;padding:3px 10px;border-radius:4px;background:rgba(204,255,0,0.1);border:1px solid rgba(204,255,0,0.3);color:#CCFF00;font-family:ui-monospace,monospace;font-size:11px;font-weight:700;margin-bottom:12px;">
        LEGAL COMPLIANCE &bull; GOOGLE OAUTH SPECIFICATION
      </div>
      <h1 style="font-size:32px;font-weight:800;color:#ffffff;margin:0 0 10px 0;letter-spacing:-0.02em;">
        Privacy Policy
      </h1>
      <p style="font-size:15px;color:#a1a1aa;margin:0 0 8px 0;">
        <strong style="color:#ffffff;">Chaos Computer Club Medi-Caps</strong> &bull; Medi-Caps University Chapter
      </p>
      <div style="font-family:ui-monospace,monospace;font-size:12px;color:#71717a;">
        <span>Effective Date: September 27, 2026</span> &bull; <span>Applies to: https://medicaps.chaoscomputerclub.in</span>
      </div>
    </header>

    <!-- MANDATORY GOOGLE LIMITED USE STATEMENT CALLOUT -->
    <div style="background:rgba(204,255,0,0.06);border:1px solid rgba(204,255,0,0.35);border-radius:8px;padding:20px;margin-bottom:36px;">
      <div style="color:#CCFF00;font-family:ui-monospace,monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
        Google API Services User Data Policy Compliance
      </div>
      <p style="color:#e4e4e7;font-size:13px;margin:0;line-height:1.6;">
        Chaos Computer Club Medi-Caps' use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style="color:#CCFF00;font-weight:600;text-decoration:underline;">Google API Services User Data Policy</a>, including the Limited Use requirements.
      </p>
    </div>

    <!-- 1. Introduction -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        1. Introduction
      </h2>
      <p>
        Welcome to <strong>Chaos Computer Club Medi-Caps</strong> ("we", "us", "our", or the "Platform"), hosted at <code>https://medicaps.chaoscomputerclub.in</code>. We are deeply committed to protecting the privacy, identity, and personal records of our students, faculty, and competitive programming cadets.
      </p>
      <p>
        This Privacy Policy explains in complete detail how our application accesses, collects, uses, stores, secures, retains, and deletes user information, with specific disclosure regarding Google OAuth user data accessed during institutional single sign-on authentication.
      </p>
    </section>

    <!-- 2. Who We Are -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        2. Who We Are
      </h2>
      <p>
        Chaos Computer Club Medi-Caps is the official student competitive programming and cybersecurity chapter operating within the Department of Computer Science &amp; Engineering at <strong>Medi-Caps University</strong>, located at A.B. Road, Pigdamber, Rau, Indore, Madhya Pradesh 453331, India.
      </p>
      <p>
        Our platform operates automated algorithmic assessments, isolated code execution sandbox runtimes (CodeBox), Elo rating systems, and campus tournaments exclusively for Medi-Caps University students and faculty.
      </p>
    </section>

    <!-- 3. Information We Collect -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        3. Information We Collect
      </h2>
      <p>We collect and process personal data across three specific scopes:</p>
      <ul style="padding-left:20px;margin-bottom:14px;">
        <li style="margin-bottom:6px;"><strong>Directly Provided Cadet Profile Information:</strong> During onboarding: full name, student handle, academic department, batch year, and enrollment number (PRN).</li>
        <li style="margin-bottom:6px;"><strong>Google OAuth Profile Information:</strong> Transmitted via Google OpenID Connect: unique Google identifier (<code>sub</code>), verified university email (<code>@medicaps.ac.in</code>), display name, and avatar picture URL.</li>
        <li style="margin-bottom:6px;"><strong>Contest Telemetry &amp; Assessment Records:</strong> Algorithmic source code submissions, testcase verdicts, runtime memory metrics, execution runtimes, tournament check-in timestamps, and rank scoreboards.</li>
      </ul>
    </section>

    <!-- 4. Google User Data We Access -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        4. Google User Data We Access
      </h2>
      <p>
        When you authenticate using Google Sign-In, our backend server exchanges your single-use authorization code for profile metadata strictly from the official endpoint (<code>https://www.googleapis.com/oauth2/v2/userinfo</code>). We access <strong>ONLY the following four data fields</strong>:
      </p>
      <ol style="padding-left:20px;margin-bottom:16px;">
        <li style="margin-bottom:8px;"><strong>Google Unique Account Identifier (<code>sub</code> / <code>id</code>):</strong> A persistent alphanumeric token that uniquely links your Google identity to your Medi-Caps cadet profile.</li>
        <li style="margin-bottom:8px;"><strong>Institutional Email Address (<code>email</code>):</strong> Your university email address ending strictly in <code>@medicaps.ac.in</code>. Used to enforce university-only eligibility and authenticate account access.</li>
        <li style="margin-bottom:8px;"><strong>Full Name (<code>name</code>):</strong> Your name as registered in the Google Workspace directory, displayed on your tournament dossier and certificates.</li>
        <li style="margin-bottom:8px;"><strong>Profile Picture URL (<code>picture</code>):</strong> The HTTPS link to your Google avatar picture, displayed on your cadet profile and leaderboard rank cards.</li>
      </ol>
      <div style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:14px;font-size:13px;color:#a1a1aa;">
        <strong style="color:#ffffff;">Explicit Exclusion:</strong> We do NOT access, collect, read, or process Google Drive files, Gmail inboxes, Google Calendar events, Google Contacts, Google Docs, or passwords. We do NOT request or store offline refresh tokens.
      </div>
    </section>

    <!-- 5. Google OAuth Scopes -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        5. Google OAuth Scopes &amp; Feature Mapping
      </h2>
      <p>
        In accordance with Google's principle of data minimization, Chaos Computer Club Medi-Caps requests strictly the three minimum standard OpenID Connect scopes:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin:16px 0;background:#121214;border:1px solid rgba(255,255,255,0.08);">
        <thead>
          <tr style="background:#18181b;color:#ffffff;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);">
            <th style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Scope URI</th>
            <th style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Information Provided</th>
            <th style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Purpose &amp; Feature</th>
            <th style="padding:10px;">Storage &amp; Retention</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
            <td style="padding:10px;font-family:ui-monospace,monospace;color:#CCFF00;border-right:1px solid rgba(255,255,255,0.08);">openid</td>
            <td style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Signed OpenID token (subject ID)</td>
            <td style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Cryptographically verifies student identity</td>
            <td style="padding:10px;">Subject ID saved in user profile row; token discarded</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
            <td style="padding:10px;font-family:ui-monospace,monospace;color:#CCFF00;border-right:1px solid rgba(255,255,255,0.08);">https://www.googleapis.com/auth/userinfo.email</td>
            <td style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Primary Google email address</td>
            <td style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Enforces @medicaps.ac.in domain eligibility &amp; account creation</td>
            <td style="padding:10px;">Stored in user database until account deletion</td>
          </tr>
          <tr>
            <td style="padding:10px;font-family:ui-monospace,monospace;color:#CCFF00;border-right:1px solid rgba(255,255,255,0.08);">https://www.googleapis.com/auth/userinfo.profile</td>
            <td style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Name and profile picture URL</td>
            <td style="padding:10px;border-right:1px solid rgba(255,255,255,0.08);">Populates cadet full name and avatar image</td>
            <td style="padding:10px;">Stored in profile row until updated or deleted</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 6. How Google User Data Is Used -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        6. How Google User Data Is Used
      </h2>
      <p>Google user data is processed solely for core educational and assessment platform operations:</p>
      <ul style="padding-left:20px;margin-bottom:14px;">
        <li style="margin-bottom:6px;"><strong>Authentication &amp; Provisioning:</strong> Verifying student identity and generating a platform authentication JWT session.</li>
        <li style="margin-bottom:6px;"><strong>Domain &amp; Institution Guard:</strong> Confirming active enrollment at Medi-Caps University by enforcing the <code>@medicaps.ac.in</code> domain rule.</li>
        <li style="margin-bottom:6px;"><strong>Tournament Identity:</strong> Generating digital campus passes with QR codes for on-site contest check-in at Medi-Caps computing labs.</li>
        <li style="margin-bottom:6px;"><strong>Leaderboard &amp; Ratings:</strong> Associating problem solutions, submission timestamps, and calculated ratings with the verified student.</li>
      </ul>
      <div style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:14px;font-size:13px;color:#ffffff;">
        <strong>Zero Commercial Use / Zero Advertising Guarantee:</strong> We do NOT sell, rent, lease, or monetize Google user data. We do NOT use Google user data for targeted advertising, credit assessment, marketing profiling, or AI training on external models.
      </div>
    </section>

    <!-- 7. How Google User Data Is Shared -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        7. How Google User Data Is Shared
      </h2>
      <p>
        Google user data is NEVER transferred to third parties except strictly necessary cloud infrastructure providers operating under strict confidentiality and security agreements:
      </p>
      <ul style="padding-left:20px;margin-bottom:14px;">
        <li style="margin-bottom:6px;"><strong>DigitalOcean:</strong> Cloud hosting infrastructure running our virtual servers and encrypted PostgreSQL 16 database.</li>
        <li style="margin-bottom:6px;"><strong>Cloudflare:</strong> Edge CDN, DDoS mitigation, and Cloudflare Turnstile bot verification.</li>
        <li style="margin-bottom:6px;"><strong>MinIO (Self-hosted):</strong> S3-compatible object storage server hosting uploaded or synced student profile avatars.</li>
        <li style="margin-bottom:6px;"><strong>Resend:</strong> Transactional email service utilized solely when sending 6-digit verification codes to users selecting email authentication.</li>
      </ul>
    </section>

    <!-- 8. Data Storage & Security -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        8. Data Storage and Security Controls
      </h2>
      <p>We maintain comprehensive technical, organizational, and physical safeguards:</p>
      <ul style="padding-left:20px;margin-bottom:14px;">
        <li style="margin-bottom:6px;"><strong>Encryption in Transit:</strong> TLS 1.3 encryption across all incoming and internal API traffic. Strict-Transport-Security (HSTS) with preloading.</li>
        <li style="margin-bottom:6px;"><strong>Encrypted HttpOnly Cookies:</strong> Session tokens and OAuth state cookies are flagged <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code>, preventing XSS and CSRF interception.</li>
        <li style="margin-bottom:6px;"><strong>Token Isolation:</strong> Ephemeral Google OAuth access tokens are held in volatile RAM only during the OAuth callback and are discarded within milliseconds.</li>
        <li style="margin-bottom:6px;"><strong>Database Protection:</strong> PostgreSQL database operates within an air-gapped private Docker bridge network without direct Internet exposure.</li>
        <li style="margin-bottom:6px;"><strong>CodeBox Sandbox Runtime:</strong> Untrusted C++, Python, Java, and Go code submitted during assessments runs inside isolated Linux <code>cgroups-v2</code> containers with memory limits and zero outbound network access.</li>
      </ul>
    </section>

    <!-- 9. Data Retention -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        9. Data Retention Policy
      </h2>
      <ul style="padding-left:20px;margin-bottom:14px;">
        <li style="margin-bottom:6px;"><strong>Google OAuth Access Tokens:</strong> Retained for <strong>0 seconds</strong> (discarded immediately after fetching userinfo).</li>
        <li style="margin-bottom:6px;"><strong>Cadet Profile &amp; Google Metadata:</strong> Retained for the duration of the student's active enrollment at Medi-Caps University.</li>
        <li style="margin-bottom:6px;"><strong>Server Access &amp; Audit Logs:</strong> Rotated and purged automatically after <strong>30 days</strong>.</li>
        <li style="margin-bottom:6px;"><strong>Encrypted Database Backups:</strong> Retained for <strong>14 rolling days</strong>, then permanently overwritten.</li>
      </ul>
    </section>

    <!-- 10. Data Deletion -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        10. Data Deletion &amp; Account Purge
      </h2>
      <p>Users have the unconditional right to delete their account and personal data through three accessible methods:</p>
      <ol style="padding-left:20px;margin-bottom:16px;">
        <li style="margin-bottom:8px;"><strong>In-App Self-Service Deletion:</strong> Log in, navigate to <a href="/settings" style="color:#CCFF00;text-decoration:underline;">Settings</a> &rarr; Danger Zone &rarr; "Delete Account". Executes <code>DELETE /api/auth/me</code>, permanently erasing user profile records, avatars, Redis caches, and session credentials.</li>
        <li style="margin-bottom:8px;"><strong>Google Account Revocation:</strong> Visit <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style="color:#CCFF00;text-decoration:underline;">myaccount.google.com/permissions</a>, select "Chaos Computer Club Medi-Caps", and click "Remove Access".</li>
        <li style="margin-bottom:8px;"><strong>Written Request:</strong> Email <a href="mailto:privacy@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:underline;">privacy@chaoscomputerclub.in</a> or <a href="mailto:info@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:underline;">info@chaoscomputerclub.in</a> from your university address. Processed within 7 business days.</li>
      </ol>
      <p>
        For detailed instructions, consult our dedicated <a href="/data-deletion" style="color:#CCFF00;text-decoration:underline;">Data Deletion Instructions</a> page.
      </p>
    </section>

    <!-- 11. User Rights -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        11. User Rights Under Applicable Law
      </h2>
      <p>
        In accordance with the Digital Personal Data Protection Act (DPDP), GDPR principles, and Google Developer Policies, you possess rights to access, inspect, rectify, export, and delete your data, and revoke consent at any time without penalty.
      </p>
    </section>

    <!-- 12. Contact Information -->
    <section style="margin-bottom:32px;">
      <h2 style="font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;margin-bottom:12px;">
        12. Contact Information &amp; Chapter Administration
      </h2>
      <p>For privacy inquiries, data deletion requests, or appeals, contact our Privacy Officers:</p>
      <div style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:16px;font-family:ui-monospace,monospace;font-size:12px;color:#d4d4d8;">
        <div><strong>Organization:</strong> Chaos Computer Club Medi-Caps</div>
        <div><strong>Department:</strong> Department of Computer Science &amp; Engineering</div>
        <div><strong>Campus:</strong> Medi-Caps University, A.B. Road, Pigdamber, Rau, Indore, MP 453331, India</div>
        <div><strong>General Inquiries:</strong> <a href="mailto:info@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:none;">info@chaoscomputerclub.in</a></div>
        <div><strong>Privacy &amp; Data Rights:</strong> <a href="mailto:privacy@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:none;">privacy@chaoscomputerclub.in</a></div>
      </div>
    </section>
  </main>

  ${renderFooter()}
</div>
`;

const termsContent = `
<div style="min-height:100vh;background:#000000;color:#d4d4d8;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  ${renderNavbar("/terms")}

  <main style="flex:1;max-width:860px;margin:0 auto;padding:40px 20px 80px;line-height:1.65;font-size:14px;">
    <header style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:24px;margin-bottom:32px;">
      <div style="display:inline-block;padding:3px 10px;border-radius:4px;background:rgba(204,255,0,0.1);border:1px solid rgba(204,255,0,0.3);color:#CCFF00;font-family:ui-monospace,monospace;font-size:11px;font-weight:700;margin-bottom:12px;">
        LEGAL AGREEMENT &bull; TERMS OF SERVICE
      </div>
      <h1 style="font-size:32px;font-weight:800;color:#ffffff;margin:0 0 10px 0;letter-spacing:-0.02em;">
        Terms of Service
      </h1>
      <p style="font-size:15px;color:#a1a1aa;margin:0 0 8px 0;">
        <strong style="color:#ffffff;">Chaos Computer Club Medi-Caps</strong> &bull; Medi-Caps University Chapter
      </p>
      <div style="font-family:ui-monospace,monospace;font-size:12px;color:#71717a;">
        <span>Effective Date: September 2026</span> &bull; <span>Applies to: https://medicaps.chaoscomputerclub.in</span>
      </div>
    </header>

    <section style="margin-bottom:28px;">
      <h2 style="font-size:18px;color:#ffffff;font-weight:700;margin-bottom:10px;">1. Purpose &amp; Acceptance</h2>
      <p>These Terms of Service govern access to and use of the competitive programming, cybersecurity challenge, and skill assessment platform hosted at <code>https://medicaps.chaoscomputerclub.in</code>, operated by Chaos Computer Club Medi-Caps.</p>
    </section>

    <section style="margin-bottom:28px;">
      <h2 style="font-size:18px;color:#ffffff;font-weight:700;margin-bottom:10px;">2. Eligibility &amp; Organization Scope</h2>
      <p>Access to official competitions, ratings, leaderboards, and qualified arena rounds is restricted to enrolled students, faculty, and authorized proctors of <strong>Medi-Caps University, Indore</strong> holding verified <code>@medicaps.ac.in</code> emails.</p>
    </section>

    <section style="margin-bottom:28px;">
      <h2 style="font-size:18px;color:#ffffff;font-weight:700;margin-bottom:10px;">3. Competition Integrity &amp; Code of Conduct</h2>
      <p>Plagiarism, automated AI generation during restricted contests, multiple accounts (Sybil), and judge queue flooding are strictly prohibited. Violations result in rating resets, disqualification, and referral to the university academic disciplinary committee.</p>
    </section>

    <section style="margin-bottom:28px;">
      <h2 style="font-size:18px;color:#ffffff;font-weight:700;margin-bottom:10px;">4. Code Execution &amp; Sandbox Security</h2>
      <p>Code submitted through the Monaco Web IDE is compiled and executed within isolated, resource-constrained container sandboxes. Attempting to escape namespaces, probe kernel memory, or open unauthorized outbound network connections is strictly prohibited.</p>
    </section>

    <section style="margin-bottom:28px;">
      <h2 style="font-size:18px;color:#ffffff;font-weight:700;margin-bottom:10px;">5. Intellectual Property</h2>
      <p>You retain ownership of the algorithms you write. Problem statements, editorial analyses, platform source code, and branding assets remain the exclusive intellectual property of Chaos Computer Club Medi-Caps.</p>
    </section>

    <section style="margin-bottom:28px;">
      <h2 style="font-size:18px;color:#ffffff;font-weight:700;margin-bottom:10px;">6. Governance &amp; Contact</h2>
      <p>Direct inquiries to chapter administration at <a href="mailto:info@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:underline;">info@chaoscomputerclub.in</a>.</p>
    </section>
  </main>

  ${renderFooter()}
</div>
`;

const dataDeletionContent = `
<div style="min-height:100vh;background:#000000;color:#d4d4d8;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  ${renderNavbar("/data-deletion")}

  <main style="flex:1;max-width:860px;margin:0 auto;padding:40px 20px 80px;line-height:1.65;font-size:14px;">
    <header style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:24px;margin-bottom:32px;">
      <div style="display:inline-block;padding:3px 10px;border-radius:4px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-family:ui-monospace,monospace;font-size:11px;font-weight:700;margin-bottom:12px;">
        USER PRIVACY &bull; DATA DELETION SPECIFICATION
      </div>
      <h1 style="font-size:32px;font-weight:800;color:#ffffff;margin:0 0 10px 0;letter-spacing:-0.02em;">
        Data Deletion Instructions
      </h1>
      <p style="font-size:15px;color:#a1a1aa;margin:0 0 8px 0;">
        How to delete your user account, remove personal data, and revoke Google OAuth access for <strong style="color:#ffffff;">Chaos Computer Club Medi-Caps</strong>.
      </p>
    </header>

    <section style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#ffffff;font-size:18px;font-weight:700;margin-top:0;">Method 1: Direct In-App Self-Service Deletion</h2>
      <p>If you have access to your account:</p>
      <ol style="padding-left:20px;font-family:ui-monospace,monospace;font-size:13px;color:#d4d4d8;">
        <li>Log in at <code>https://medicaps.chaoscomputerclub.in/auth</code></li>
        <li>Open your <strong>Settings</strong> page (<code>/settings</code>)</li>
        <li>Scroll down to the <strong>Danger Zone</strong> section</li>
        <li>Click <strong>Delete Account</strong> and confirm your choice</li>
      </ol>
      <p style="font-size:12px;color:#a1a1aa;margin-top:12px;">Effect: Executes <code>DELETE /api/auth/me</code>, immediately invalidating active sessions, wiping PostgreSQL profile rows, deleting MinIO avatar assets, and purging Redis caches.</p>
    </section>

    <section style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#ffffff;font-size:18px;font-weight:700;margin-top:0;">Method 2: Revoking Google OAuth Permissions</h2>
      <p>Disconnect Chaos Computer Club Medi-Caps directly from your Google Account:</p>
      <ol style="padding-left:20px;font-family:ui-monospace,monospace;font-size:13px;color:#d4d4d8;">
        <li>Visit <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style="color:#CCFF00;text-decoration:underline;">myaccount.google.com/permissions</a></li>
        <li>Locate <strong>Chaos Computer Club Medi-Caps</strong> under "Third-party apps with account access"</li>
        <li>Click <strong>Remove Access</strong> and confirm</li>
      </ol>
    </section>

    <section style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:24px;">
      <h2 style="color:#ffffff;font-size:18px;font-weight:700;margin-top:0;">Method 3: Written Request via Email</h2>
      <p>Send an email from your registered <code>@medicaps.ac.in</code> address to <a href="mailto:info@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:underline;">info@chaoscomputerclub.in</a> or <a href="mailto:privacy@chaoscomputerclub.in" style="color:#CCFF00;text-decoration:underline;">privacy@chaoscomputerclub.in</a> with Subject: <code>[DATA DELETION REQUEST]</code>. Processed within 7 business days.</p>
    </section>
  </main>

  ${renderFooter()}
</div>
`;

const homeContent = `
<div style="min-height:100vh;background:#000000;color:#d4d4d8;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  ${renderNavbar("/")}

  <main style="flex:1;max-width:1100px;margin:0 auto;padding:48px 20px 80px;">
    <!-- Hero Section -->
    <div style="text-align:center;padding:40px 0 60px;max-width:800px;margin:0 auto;">
      <div style="display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:9999px;background:rgba(204,255,0,0.1);border:1px solid rgba(204,255,0,0.25);color:#CCFF00;font-family:ui-monospace,monospace;font-size:12px;font-weight:700;margin-bottom:20px;">
        <span>OFFICIAL CHAPTER &bull; MEDI-CAPS UNIVERSITY INDORE</span>
      </div>
      <h1 style="font-size:46px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;margin:0 0 16px 0;line-height:1.15;">
        Chaos Computer Club <span style="color:#CCFF00;">Medi-Caps</span>
      </h1>
      <p style="font-size:18px;color:#a1a1aa;line-height:1.6;margin:0 0 28px 0;">
        The collegiate competitive programming and cybersecurity chapter of Medi-Caps University. Real-time tournament arenas, kernel-isolated sandboxes, and institutional rank ladders.
      </p>
      <div style="display:flex;justify-content:center;gap:14px;font-family:ui-monospace,monospace;font-size:13px;">
        <a href="/auth" style="background:#CCFF00;color:#000000;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none;">Enter Cadet Portal</a>
        <a href="/about" style="border:1px solid rgba(255,255,255,0.15);color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;">About Chapter</a>
      </div>
    </div>

    <!-- Feature Pillars -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px;margin-bottom:60px;">
      <div style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:24px;">
        <h3 style="color:#CCFF00;font-size:16px;font-family:ui-monospace,monospace;font-weight:700;margin-top:0;">Monaco Web IDE &amp; CodeBox</h3>
        <p style="font-size:13px;color:#a1a1aa;line-height:1.6;margin:0;">Proctored browser IDE with kernel-isolated Linux cgroups-v2 sandbox evaluating C++, Python, Java, and Go algorithms with millisecond precision.</p>
      </div>
      <div style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:24px;">
        <h3 style="color:#CCFF00;font-size:16px;font-family:ui-monospace,monospace;font-weight:700;margin-top:0;">Institutional Tournaments</h3>
        <p style="font-size:13px;color:#a1a1aa;line-height:1.6;margin:0;">Weekly speed contests, departmental leaderboards, and verified digital campus passes with QR codes for on-site lab sessions.</p>
      </div>
      <div style="background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:24px;">
        <h3 style="color:#CCFF00;font-size:16px;font-family:ui-monospace,monospace;font-weight:700;margin-top:0;">Applied Security &amp; CTFs</h3>
        <p style="font-size:13px;color:#a1a1aa;line-height:1.6;margin:0;">Hands-on systems exploitation, reverse engineering, web security, and cryptography challenges grounded in ethical hacker culture.</p>
      </div>
    </div>
  </main>

  ${renderFooter()}
</div>
`;

// Helper to assemble full HTML file with injected content
function buildHtml(pageTitle, canonicalUrl, pageContent) {
  let html = templateHtml;

  // Replace Title
  html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);

  // Replace Canonical Link
  html = html.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${canonicalUrl}" />`);

  // Inject content inside <div id="root">
  const rootRegex = /<div id="root">[\s\S]*?<\/div>/;
  html = html.replace(rootRegex, `<div id="root">${pageContent}</div>`);

  return html;
}

// Generate static files
const pages = [
  {
    path: "privacy",
    title: "Privacy Policy — Chaos Computer Club Medi-Caps",
    canonical: "https://medicaps.chaoscomputerclub.in/privacy",
    content: privacyContent,
  },
  {
    path: "terms",
    title: "Terms of Service — Chaos Computer Club Medi-Caps",
    canonical: "https://medicaps.chaoscomputerclub.in/terms",
    content: termsContent,
  },
  {
    path: "data-deletion",
    title: "Data Deletion Instructions — Chaos Computer Club Medi-Caps",
    canonical: "https://medicaps.chaoscomputerclub.in/data-deletion",
    content: dataDeletionContent,
  },
];

console.log("→ Prerendering static HTML for Google verification pages...");

// 1. Write public subpages as both directory/index.html and path.html for absolute Nginx compatibility
for (const page of pages) {
  const pageDir = path.join(distDir, page.path);
  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }

  const renderedHtml = buildHtml(page.title, page.canonical, page.content);
  fs.writeFileSync(path.join(pageDir, "index.html"), renderedHtml, "utf-8");
  fs.writeFileSync(path.join(distDir, `${page.path}.html`), renderedHtml, "utf-8");
  console.log(`  ✓ Prerendered /${page.path} (index.html & ${page.path}.html)`);
}

// 2. Also inject public landing homepage into dist/index.html
const homeHtml = buildHtml(
  "Chaos Computer Club Medi-Caps",
  "https://medicaps.chaoscomputerclub.in/",
  homeContent
);
fs.writeFileSync(templatePath, homeHtml, "utf-8");
console.log("  ✓ Prerendered / (dist/index.html) with full public landing homepage");

console.log("✅ Static prerender complete! All public pages contain 100% substantive static HTML for automated crawlers.");
