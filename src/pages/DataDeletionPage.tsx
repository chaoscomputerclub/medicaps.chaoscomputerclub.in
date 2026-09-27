import React from "react";
import { Link } from "react-router-dom";
import { PublicNavbar } from "../components/public/PublicNavbar";
import { PublicFooter } from "../components/public/PublicFooter";
import { Trash2, Key, ShieldCheck, Mail, AlertTriangle, ExternalLink, ArrowRight } from "lucide-react";

export function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-[#CCFF00]/30 selection:text-white flex flex-col font-sans antialiased">
      <PublicNavbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Header */}
        <header className="border-b border-white/10 pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-xs mb-4">
            <Trash2 className="w-3.5 h-3.5" />
            <span>User Privacy &amp; Data Rights</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
            Data Deletion Instructions
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            How to delete your user account, remove your personal information, and revoke Google OAuth access for{" "}
            <span className="text-white font-medium">Chaos Computer Club Medi-Caps</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
            <span>Last Updated: September 2026</span>
            <span>•</span>
            <span>Compliance: Google API Services User Data Policy</span>
          </div>
        </header>

        {/* Overview Box */}
        <div className="p-5 rounded-lg border border-white/10 bg-zinc-950/60 mb-10">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#CCFF00] mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Our Privacy Commitment
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            In compliance with the Google API Services User Data Policy and data protection regulations, users of{" "}
            <strong>Chaos Computer Club Medi-Caps</strong> have full control over their personal data. You may request or directly execute the deletion of all personal data, Google profile details, authentication credentials, and account records at any time.
          </p>
        </div>

        {/* Methods */}
        <div className="space-y-8 text-zinc-300 text-sm leading-relaxed">
          {/* Method 1: Self-Service in App */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center font-mono font-bold text-[#CCFF00]">
                1
              </div>
              <h2 className="text-lg font-bold text-white font-mono">
                Method 1: Direct In-App Self-Service Deletion
              </h2>
            </div>
            <p className="mb-4">
              If you have access to your account, you can initiate immediate self-service account deletion directly from your settings panel:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-zinc-300 bg-black/50 p-4 rounded border border-white/5 font-mono text-xs">
              <li>Log in to your account at <Link to="/auth" className="text-[#CCFF00] underline">medicaps.chaoscomputerclub.in/auth</Link>.</li>
              <li>Navigate to your <strong className="text-white">Settings</strong> page (<Link to="/settings" className="text-[#CCFF00] underline">/settings</Link>).</li>
              <li>Scroll down to the <strong className="text-red-400">Danger Zone</strong> section.</li>
              <li>Click on <strong className="text-red-400">Delete Account</strong>.</li>
              <li>Confirm your intent in the confirmation modal.</li>
            </ol>
            <div className="mt-4 p-3 bg-zinc-900/60 rounded border border-white/5 text-xs text-zinc-400">
              <strong className="text-zinc-200">Execution Effect:</strong> This immediately invokes our backend deletion handler (<code className="font-mono text-zinc-300">DELETE /api/auth/me</code>), invalidating active sessions, revoking Redis cache entries, purging avatar assets from object storage, and permanently removing your user record from PostgreSQL.
            </div>
          </section>

          {/* Method 2: Revoke Google Permissions */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center font-mono font-bold text-[#CCFF00]">
                2
              </div>
              <h2 className="text-lg font-bold text-white font-mono">
                Method 2: Revoking Google OAuth Access via Google Security
              </h2>
            </div>
            <p className="mb-3">
              You can disconnect <strong className="text-white">Chaos Computer Club Medi-Caps</strong> from your Google Account at any time directly through Google&apos;s security dashboard:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-zinc-300 bg-black/50 p-4 rounded border border-white/5 font-mono text-xs">
              <li>Open your Google Account permissions page:{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#CCFF00] inline-flex items-center gap-1 underline"
                >
                  myaccount.google.com/permissions <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Locate <strong className="text-white">&ldquo;Chaos Computer Club Medi-Caps&rdquo;</strong> under Third-party apps with account access.</li>
              <li>Click on the entry and select <strong className="text-red-400">&ldquo;Remove Access&rdquo;</strong> (or &ldquo;Delete all connections&rdquo;).</li>
              <li>Confirm the revocation.</li>
            </ol>
            <p className="mt-3 text-xs text-zinc-400">
              Revoking access immediately blocks our backend from verifying your Google identity or receiving any profile updates from Google.
            </p>
          </section>

          {/* Method 3: Email Request */}
          <section className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center font-mono font-bold text-[#CCFF00]">
                3
              </div>
              <h2 className="text-lg font-bold text-white font-mono">
                Method 3: Written Deletion Request via Email
              </h2>
            </div>
            <p className="mb-3">
              If you cannot access your account or prefer an administrator-verified purge, you may send a written deletion request:
            </p>
            <div className="p-4 rounded bg-black/60 border border-white/10 space-y-2 font-mono text-xs">
              <p><span className="text-zinc-400">Recipient:</span> <a href="mailto:info@chaoscomputerclub.in" className="text-[#CCFF00] underline">info@chaoscomputerclub.in</a></p>
              <p><span className="text-zinc-400">Subject:</span> [DATA DELETION REQUEST] - Chaos Computer Club Medi-Caps</p>
              <p><span className="text-zinc-400">Required Details:</span></p>
              <ul className="list-disc list-inside ml-2 text-zinc-300 space-y-1">
                <li>Your full name as registered</li>
                <li>Your Medi-Caps university email address (<span className="text-zinc-400 font-mono">user@medicaps.ac.in</span>)</li>
                <li>Your Enrollment Number / PRN</li>
                <li>Your Google Account email used during OAuth registration</li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              <strong className="text-zinc-200">Processing SLA:</strong> Written requests sent from the registered Medi-Caps email address are processed within <strong>7 business days</strong>. You will receive a written confirmation receipt once all associated records have been expunged.
            </p>
          </section>

          {/* What gets deleted vs retained */}
          <section className="border-t border-white/10 pt-8">
            <h2 className="text-lg font-bold text-white font-mono mb-4">
              Data Scope: What Gets Deleted vs. Anonymized
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded border border-red-500/20 bg-red-950/10">
                <h3 className="text-xs font-mono uppercase tracking-wider text-red-400 font-bold mb-2 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Permanently Purged
                </h3>
                <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                  <li>Google Account ID (<code className="font-mono">sub</code>)</li>
                  <li>Google Profile Picture URL &amp; synced avatars</li>
                  <li>Full Name and institutional email address</li>
                  <li>Campus Pass QR codes &amp; verification tokens</li>
                  <li>Session cookies, refresh tokens, and Redis cache entries</li>
                  <li>User profile, bio, social handles, and preferences</li>
                </ul>
              </div>

              <div className="p-4 rounded border border-amber-500/20 bg-amber-950/10">
                <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Anonymized / Institutional Records
                </h3>
                <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                  <li>Historical contest code submissions are stripped of all PII and reassigned to <code className="font-mono text-zinc-200">[DELETED_CADET]</code>.</li>
                  <li>Aggregated contest rank points for completed official tournaments remain fixed to preserve tournament standings for other competitors.</li>
                  <li>Server security logs (IP addresses stripped of user linkage) retained up to 30 days for anti-abuse audits.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Cross links */}
          <div className="border-t border-white/10 pt-8 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <Link to="/privacy" className="text-[#CCFF00] hover:underline flex items-center gap-1">
              ← Read Privacy Policy
            </Link>
            <Link to="/contact" className="text-zinc-400 hover:text-white flex items-center gap-1">
              Contact Privacy Team <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default DataDeletionPage;
