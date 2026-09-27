import React from "react";
import { Link } from "react-router-dom";
import { PublicNavbar } from "../components/public/PublicNavbar";
import { PublicFooter } from "../components/public/PublicFooter";
import { Terminal, Shield, Cpu, Users, Code, Award, ExternalLink, ArrowRight } from "lucide-react";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-[#CCFF00]/30 selection:text-white flex flex-col font-sans antialiased">
      <PublicNavbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Header */}
        <header className="border-b border-white/10 pb-8 mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] font-mono text-xs mb-4">
            <Terminal className="w-3.5 h-3.5" />
            <span>Institutional Student Technical Chapter</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono">
            About Chaos Computer Club Medi-Caps
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-300 max-w-3xl leading-relaxed">
            The collegiate chapter of Chaos Computer Club at Medi-Caps University, dedicated to algorithmic excellence, applied security engineering, and high-performance competitive programming.
          </p>
        </header>

        {/* Institutional Affiliation Banner */}
        <div className="p-6 rounded-lg border border-white/10 bg-zinc-950/60 mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">Host Institution</div>
            <h2 className="text-xl font-bold text-white">Medi-Caps University, Indore</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Department of Computer Science and Engineering, Faculty of Engineering &amp; Technology<br />
              A.B. Road, Pigdamber, Rau, Indore, Madhya Pradesh 453331, India
            </p>
          </div>
          <div className="font-mono text-xs text-zinc-400 bg-black/60 p-4 rounded border border-white/5 space-y-1">
            <div><span className="text-zinc-400">Chapter ID:</span> <span className="text-[#CCFF00]">CCC-MU-INDORE</span></div>
            <div><span className="text-zinc-400">Domain:</span> <span className="text-white">medicaps.chaoscomputerclub.in</span></div>
            <div><span className="text-zinc-400">Status:</span> <span className="text-[#CCFF00]">Active Collegiate Chapter</span></div>
          </div>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <div className="w-10 h-10 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] mb-4">
              <Code className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white font-mono mb-2">Algorithmic Competitive Arena</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We engineer our own browser-based Monaco IDE with kernel-isolated sandboxes, hosting automated algorithmic assessments, weekly speed contests, and institutional rank ladders.
            </p>
          </div>

          <div className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <div className="w-10 h-10 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white font-mono mb-2">Applied Cybersecurity &amp; CTFs</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Rooted in the hacker ethics of curiosity and open inquiry, we train cadets in binary exploitation, web security, cryptography, reverse engineering, and threat analysis.
            </p>
          </div>

          <div className="p-6 rounded-lg border border-white/10 bg-zinc-950/40">
            <div className="w-10 h-10 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white font-mono mb-2">Infrastructure &amp; Tooling</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Students build, operate, and benchmark low-latency microservices, real-time Server-Sent Event pipelines, and ephemeral execution engines running on Linux primitives.
            </p>
          </div>
        </div>

        {/* Mission Statement */}
        <section className="mb-16 border-t border-white/10 pt-12">
          <h2 className="text-2xl font-black text-white font-mono mb-4">Our Charter &amp; Hacker Ethics</h2>
          <div className="space-y-4 text-zinc-300 text-sm leading-relaxed">
            <p>
              Chaos Computer Club Medi-Caps operates under the founding principles of the global hacker culture: access to computers and anything which may teach you something about the way the world works should be unlimited and total; mistrusted authority should be challenged with decentralized knowledge; and human creativity should be evaluated by what you build, not bogus criteria such as degrees, age, or position.
            </p>
            <p>
              At Medi-Caps University, our chapter bridges rigorous classroom computer science curricula with hands-on systems hacking, open-source contribution, and international competitive programming standards (ICPC, Google Code Jam, Codeforces).
            </p>
          </div>
        </section>

        {/* Technical Architecture */}
        <section className="mb-16 border-t border-white/10 pt-12">
          <h2 className="text-2xl font-black text-white font-mono mb-4">Platform Architecture</h2>
          <p className="text-sm text-zinc-400 mb-6">
            The <strong className="text-white">medicaps.chaoscomputerclub.in</strong> platform is completely engineered and maintained by students:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-4 rounded border border-white/10 bg-zinc-950/60">
              <span className="text-[#CCFF00] font-bold block mb-1">Frontend Client</span>
              <p className="text-zinc-400">Vite 6, React 18, TypeScript, Tailwind CSS, Monaco Web IDE, Redux Toolkit.</p>
            </div>
            <div className="p-4 rounded border border-white/10 bg-zinc-950/60">
              <span className="text-[#CCFF00] font-bold block mb-1">Backend Microservices</span>
              <p className="text-zinc-400">FastAPI, Python 3.11, PostgreSQL 16, Redis 7 Pub/Sub, MinIO S3 Object Storage.</p>
            </div>
            <div className="p-4 rounded border border-white/10 bg-zinc-950/60">
              <span className="text-[#CCFF00] font-bold block mb-1">Judge Engine</span>
              <p className="text-zinc-400">Linux cgroups-v2 isolated sandbox with rlimit memory and CPU execution controls.</p>
            </div>
            <div className="p-4 rounded border border-white/10 bg-zinc-950/60">
              <span className="text-[#CCFF00] font-bold block mb-1">Identity &amp; OAuth</span>
              <p className="text-zinc-400">Strict Google OpenID Connect verification restricted to @medicaps.ac.in domain.</p>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="border-t border-white/10 pt-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-white font-mono">Ready to compete or contribute?</h3>
            <p className="text-xs text-zinc-400 mt-1">Sign in with your Medi-Caps Google account to join active challenges.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="px-5 py-2.5 rounded bg-[#CCFF00] text-black font-mono font-bold text-xs hover:bg-[#b8e600] transition-colors inline-flex items-center gap-2"
            >
              Sign In to Cadet Portal <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default AboutPage;
