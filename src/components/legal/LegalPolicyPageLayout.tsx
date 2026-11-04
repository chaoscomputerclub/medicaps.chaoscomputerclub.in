/**
 * Chaos Computer Club — Statutory Policy Layout & Dynamic Policy Viewer
 * Fetches and displays versioned statutory legal policies from the backend API,
 * with graceful fallback to built-in statutory text.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReadmeRenderer } from "@/components/problem/ReadmeRenderer";
import { ShieldCheck, FileText, ArrowLeft } from "lucide-react";
import { WanderingEyes } from "@/components/ui/WanderingEyes";

interface PolicyData {
  id?: string;
  policy_type: string;
  version: string;
  title: string;
  content: string;
  change_summary?: string;
  effective_date?: string;
}

interface LegalPolicyPageLayoutProps {
  policyType: "TERMS_OF_SERVICE" | "PRIVACY_POLICY" | "CONTEST_RULES" | "CODE_OF_CONDUCT" | "ACCEPTABLE_USE";
  defaultTitle: string;
  defaultVersion?: string;
  defaultContent: string;
}

const POLICY_LINKS = [
  { path: "/terms", label: "Terms" },
  { path: "/privacy", label: "Privacy" },
  { path: "/rules", label: "Contest Rules" },
  { path: "/conduct", label: "Code of Conduct" },
  { path: "/acceptable-use", label: "Acceptable Use" },
];

export function LegalPolicyPageLayout({
  policyType,
  defaultTitle,
  defaultVersion = "1.0.0",
  defaultContent,
}: LegalPolicyPageLayoutProps) {
  const [policy, setPolicy] = useState<PolicyData>({
    policy_type: policyType,
    version: defaultVersion,
    title: defaultTitle,
    content: defaultContent,
    change_summary: "Initial release",
    effective_date: "2026-11-01",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchPolicy() {
      try {
        const res = await fetch(`/api/policies/${policyType}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.content) {
            setPolicy(data);
          }
        }
      } catch (err) {
        console.warn(`Could not fetch policy for ${policyType}:`, err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchPolicy();
    return () => {
      isMounted = false;
    };
  }, [policyType]);

  return (
    <main className="min-h-screen w-full bg-[#0a0a0c] text-zinc-300 antialiased selection:bg-[#B1FA63]/30 selection:text-white font-sans">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
        {/* Top Navigation */}
        <div className="flex items-center justify-between pb-8 border-b border-white/[0.08]">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Arena</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/[0.04] border border-white/[0.08] text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B1FA63]" />
              <span>Version {policy.version}</span>
            </span>
          </div>
        </div>

        {/* Brand Header */}
        <header className="pt-10 pb-8">
          <div className="flex items-center gap-2 text-xs font-mono text-[#B1FA63] uppercase tracking-wider mb-2">
            <FileText className="w-4 h-4" />
            <span>Statutory Platform Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight text-white uppercase">
            {policy.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 font-mono">
            <span>Effective Date: {policy.effective_date ? new Date(policy.effective_date).toLocaleDateString() : "Active"}</span>
            <span>•</span>
            <span>Applies Globally: chaoscomputerclub.in</span>
            <span>•</span>
            <span>Change: {policy.change_summary || "Published standard"}</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#111114] p-6 sm:p-10 shadow-2xl">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-xs text-zinc-500 gap-2">
              <WanderingEyes size="sm" />
              <span>Loading policy ledger...</span>
            </div>
          ) : (
            <ReadmeRenderer content={policy.content} className="prose prose-invert max-w-none text-zinc-300 space-y-6" />
          )}
        </div>

        {/* Statutory Policy Cross-Navigation */}
        <footer className="mt-12 pt-8 border-t border-white/[0.08] text-center sm:text-left">
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">
            Chaos Computer Club Governance & Policies
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-mono">
            {POLICY_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="text-zinc-400 hover:text-[#B1FA63] underline underline-offset-4 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p className="mt-6 text-[11px] text-zinc-600">
            &copy; {new Date().getFullYear()} Chaos Computer Club India. All rights reserved. Sandboxed execution environment complies with international competitive programming and statutory cybersecurity guidelines.
          </p>
        </footer>
      </div>
    </main>
  );
}
