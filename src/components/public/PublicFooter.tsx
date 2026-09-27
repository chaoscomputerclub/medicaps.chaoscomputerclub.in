/**
 * Chaos Computer Club Medi-Caps
 * src/components/public/PublicFooter.tsx — Accessible Legal & Informational Footer
 */

import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Mail, MapPin, ExternalLink } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-black text-zinc-400 text-xs">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Organization Information */}
          <div className="space-y-3 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.webp" alt="Chaos Computer Club" className="h-7 w-7 object-contain" />
              <span className="font-sans font-bold text-white text-sm">Chaos Computer Club Medi-Caps</span>
            </Link>
            <p className="text-zinc-400 text-xs leading-relaxed">
              The official competitive programming and cybersecurity chapter of Medi-Caps University, Indore. Proctored algorithmic tournaments, air-gapped sandboxed evaluation, and cryptographic rating ledgers.
            </p>
            <div className="inline-flex items-center gap-1.5 rounded bg-lime-400/10 border border-lime-400/20 px-2.5 py-1 text-[11px] font-mono text-lime-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Campus Sandbox Node</span>
            </div>
          </div>

          {/* Platform Navigation */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">Platform</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="hover:text-lime-400 transition-colors">Overview</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-lime-400 transition-colors">About Chapter</Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-lime-400 transition-colors">Cadet Sign In</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-lime-400 transition-colors">Campus Coordination</Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance (Required by Google OAuth Verification) */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">Legal & Privacy</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="hover:text-lime-400 transition-colors font-medium text-zinc-300">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-lime-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/data-deletion" className="hover:text-lime-400 transition-colors">
                  User Data Deletion
                </Link>
              </li>
              <li>
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                >
                  <span>Google User Data Policy</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Institutional Contact */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">Institutional Contact</h4>
            <div className="space-y-2 text-zinc-400 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-lime-400 shrink-0 mt-0.5" />
                <span>
                  Medi-Caps University, AB Road, Pigdamber, Rau, Indore, Madhya Pradesh 453331, India
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-lime-400 shrink-0" />
                <a href="mailto:info@chaoscomputerclub.in" className="hover:text-white transition-colors">
                  info@chaoscomputerclub.in
                </a>
              </div>
              <p className="text-[11px] text-zinc-400 pt-1">
                Faculty Advisor: Dept. of Computer Science &amp; Engineering, Medi-Caps University
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 border-t border-white/[0.08] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <p>
            &copy; 2026 Chaos Computer Club Medi-Caps. All rights reserved.
          </p>
          <p className="font-mono text-[10px]">
            Application: <span className="text-zinc-300">Chaos Computer Club Medi-Caps</span> &bull; Scope: <span className="text-lime-400">@medicaps.ac.in</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
