/**
 * Chaos Computer Club Medi-Caps
 * src/pages/LandingHomePage.tsx — Public Homepage (Accessible without Authentication)
 * Conforms to Google OAuth Verification & Vercel Web Interface Guidelines.
 */

import React from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Terminal,
  Trophy,
  Cpu,
  Lock,
  ArrowRight,
  Code2,
  CheckCircle2,
  Zap,
  BookOpen,
  MapPin,
  Mail,
  Users,
} from "lucide-react";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";
import { isAuthenticated } from "@/lib/auth";

export function LandingHomePage() {
  const isAuth = isAuthenticated();

  return (
    <div className="min-h-screen bg-black text-white antialiased selection:bg-lime-400 selection:text-black flex flex-col">
      <PublicNavbar />

      <main className="flex-1">
        {/* ── HERO SECTION ── */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-white/[0.08]">
          {/* Subtle Ambient Light Ray Effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-lime-400/5 blur-[120px] pointer-events-none rounded-full" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            {/* Mission Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-3.5 py-1 text-xs font-mono font-medium text-lime-400 mb-6 shadow-[0_0_15px_rgba(204,255,0,0.15)]">
              <span className="size-2 rounded-full bg-lime-400 animate-pulse" />
              <span>OFFICIAL UNIVERSITY CHAPTER &bull; AIR-GAPPED CODE ARENA</span>
            </div>

            {/* Primary Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl max-w-4xl mx-auto leading-tight">
              Chaos Computer Club <span className="text-lime-400">Medi-Caps</span>
            </h1>

            {/* Sub-headline */}
            <p className="mt-5 text-base sm:text-xl text-zinc-300 max-w-2xl mx-auto font-sans leading-relaxed">
              The official competitive programming and cybersecurity chapter of Medi-Caps University, Indore. Proctored algorithmic tournaments, real-time code sandboxes, and cryptographic rating ledgers.
            </p>

            {/* Primary Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {isAuth ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-md bg-lime-400 px-6 py-3 font-mono text-sm font-bold text-black transition-all hover:bg-lime-300 shadow-[0_0_25px_rgba(204,255,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <Terminal className="h-4 w-4" />
                  <span>Enter Cadet Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-md bg-lime-400 px-6 py-3 font-sans text-sm font-bold text-black transition-all hover:bg-lime-300 shadow-[0_0_25px_rgba(204,255,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <span>Sign In with Medi-Caps Google ID</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-zinc-950 px-5 py-3 font-sans text-sm font-medium text-white transition-all hover:border-white/30 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <BookOpen className="h-4 w-4 text-zinc-400" />
                <span>About Chapter &amp; Mission</span>
              </Link>
            </div>

            {/* Live Telemetry Counter Badges */}
            <div className="mt-14 pt-8 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/60 text-center">
                <span className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">0.001s</span>
                <span className="block text-[11px] text-zinc-400 uppercase tracking-wider font-mono mt-1">Evaluation Precision</span>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/60 text-center">
                <span className="font-mono text-xl sm:text-2xl font-bold text-lime-400 tabular-nums">Air-Gapped</span>
                <span className="block text-[11px] text-zinc-400 uppercase tracking-wider font-mono mt-1">CodeBox Sandbox</span>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/60 text-center">
                <span className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">RS256</span>
                <span className="block text-[11px] text-zinc-400 uppercase tracking-wider font-mono mt-1">Token Integrity</span>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-zinc-950/60 text-center">
                <span className="font-mono text-xl sm:text-2xl font-bold text-lime-400 tabular-nums">@medicaps.ac.in</span>
                <span className="block text-[11px] text-zinc-400 uppercase tracking-wider font-mono mt-1">Google SSO Gate</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── ABOUT THE ORGANIZATION & PURPOSE ── */}
        <section id="about" className="py-16 sm:py-24 border-b border-white/[0.08] bg-zinc-950/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded bg-zinc-900 border border-white/10 px-3 py-1 text-xs font-mono text-zinc-300">
                  <Shield className="h-3.5 w-3.5 text-lime-400" />
                  <span>Department of Computer Science &amp; Engineering</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Dedicated to Technical Rigor &amp; Competitive Excellence
                </h2>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Chaos Computer Club Medi-Caps is the premier university-level computing collective at Medi-Caps University, Indore. Our charter brings together passionate programmers, systems developers, and cybersecurity researchers to master algorithms, secure architecture, and computational problem solving.
                </p>
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-lime-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white text-sm block">Weekly Tournament Cadence</strong>
                      <p className="text-xs text-zinc-400 mt-0.5">Every Wednesday from 3:00 PM to 4:30 PM IST, cadets compete in 90-minute live algorithmic contests under strict time and memory limits.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-lime-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white text-sm block">Institutional Google Workspace Integration</strong>
                      <p className="text-xs text-zinc-400 mt-0.5">Streamlined single sign-on restricted to official Medi-Caps University email accounts (@medicaps.ac.in), preserving student identity and academic integrity.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-lime-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white text-sm block">Fair Play &amp; Anti-Cheat Telemetry</strong>
                      <p className="text-xs text-zinc-400 mt-0.5">Physical lab workstations operate within an air-gapped sandbox network with proctor gate verification and automated violation sentinels.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tactical Code / Terminal Visual Preview */}
              <div className="rounded-lg border border-white/10 bg-black p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-red-500/80" />
                    <span className="size-2.5 rounded-full bg-yellow-500/80" />
                    <span className="size-2.5 rounded-full bg-lime-500/80" />
                    <span className="text-zinc-400 ml-2">ccc-node-lab04.medicaps.ac.in</span>
                  </div>
                  <span className="text-lime-400 text-[11px]">ACTIVE SANDBOX</span>
                </div>
                <div className="font-mono text-xs text-zinc-300 space-y-2 leading-relaxed">
                  <p className="text-zinc-500">// Medi-Caps Tournament Engine v2.4</p>
                  <p><span className="text-lime-400">$</span> ccc auth verify --institutional</p>
                  <p className="text-zinc-400">&gt; Domain match: @medicaps.ac.in [VALID]</p>
                  <p className="text-zinc-400">&gt; Google OAuth identity token verified via RS256</p>
                  <p className="text-zinc-400">&gt; Cadet PRN extracted: EN23CS301***</p>
                  <p><span className="text-lime-400">$</span> codebox-engine run --contest weekly-contest-3</p>
                  <p className="text-zinc-400">&gt; Sandboxing 4 challenges: [A, B, C, D]</p>
                  <p className="text-lime-400">&gt; Status: 100% test cases passed [AC] (12ms)</p>
                  <p className="text-zinc-500">&gt; University Elo updated: +48 &rarr; 1640 (Rank #12)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── KEY FEATURES & SERVICES ── */}
        <section id="features" className="py-16 sm:py-24 border-b border-white/[0.08]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-lime-400">Engineered Architecture</h2>
              <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Platform Capabilities</p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Every subsystem is crafted for speed, transparency, and university competition integrity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-6 rounded-lg border border-white/10 bg-zinc-950 hover:border-lime-400/30 transition-all space-y-3">
                <div className="p-2.5 rounded-md bg-lime-400/10 border border-lime-400/20 text-lime-400 w-fit">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Air-Gapped CodeBox Sandbox</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Evaluates solutions in Python, C, C++, Java, JavaScript, and TypeScript in isolated execution environments with sub-millisecond telemetry and strict memory limits.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-lg border border-white/10 bg-zinc-950 hover:border-lime-400/30 transition-all space-y-3">
                <div className="p-2.5 rounded-md bg-lime-400/10 border border-lime-400/20 text-lime-400 w-fit">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Google Workspace SSO</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Secure institutional authentication via Google OAuth 2.0. Strictly limited to minimal scopes (openid, email, profile) with zero external data sharing.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-lg border border-white/10 bg-zinc-950 hover:border-lime-400/30 transition-all space-y-3">
                <div className="p-2.5 rounded-md bg-lime-400/10 border border-lime-400/20 text-lime-400 w-fit">
                  <Trophy className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">University Elo Leaderboards</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Dynamic mathematical Elo rating engine tracking student rank, solved challenge dossiers, and verifiable achievement proofs across engineering batches.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-lg border border-white/10 bg-zinc-950 hover:border-lime-400/30 transition-all space-y-3">
                <div className="p-2.5 rounded-md bg-lime-400/10 border border-lime-400/20 text-lime-400 w-fit">
                  <Code2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Problem Master Vault</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Extensive problem archive spanning Data Structures, Algorithms, Graph Theory, Dynamic Programming, and Cryptographic Security with 15+ hidden testcases per problem.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-lg border border-white/10 bg-zinc-950 hover:border-lime-400/30 transition-all space-y-3">
                <div className="p-2.5 rounded-md bg-lime-400/10 border border-lime-400/20 text-lime-400 w-fit">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Real-Time Event Multiplexer</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Low-latency Server-Sent Events (SSE) broadcasting live scoreboards, contest lifecycle transitions, and instant testcase evaluation verdicts.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-lg border border-white/10 bg-zinc-950 hover:border-lime-400/30 transition-all space-y-3">
                <div className="p-2.5 rounded-md bg-lime-400/10 border border-lime-400/20 text-lime-400 w-fit">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">Cryptographic Result Proofs</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Every contest completion generates an immutable cryptographic verification hash, guaranteeing tamper-proof records for academic portfolios.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── COMMUNITY & CAMPUS LOCATION ── */}
        <section className="py-16 sm:py-24 border-b border-white/[0.08] bg-zinc-950/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-8 sm:p-12 relative overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded bg-lime-400/10 border border-lime-400/20 px-3 py-1 text-xs font-mono text-lime-400">
                    <Users className="h-3.5 w-3.5" />
                    <span>Cadet Community</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white">
                    Built for Medi-Caps University Engineering Students
                  </h3>
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    Access to the arena is open to all enrolled students and faculty members of Medi-Caps University. Simply authenticate using your institutional Google Workspace email (@medicaps.ac.in) to receive your competitive cadet credentials.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-lime-400" />
                      <span>Lab 04, Computer Center, Medi-Caps Campus</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-lime-400" />
                      <span>info@chaoscomputerclub.in</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
                  <Link
                    to="/auth"
                    className="w-full sm:w-auto text-center rounded-md bg-lime-400 px-6 py-3 font-mono text-xs font-bold text-black transition-all hover:bg-lime-300 shadow-[0_0_20px_rgba(204,255,0,0.25)]"
                  >
                    Authenticate with Google
                  </Link>
                  <Link
                    to="/privacy"
                    className="w-full sm:w-auto text-center rounded-md border border-white/20 bg-zinc-900 px-5 py-3 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
                  >
                    Read Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default LandingHomePage;
