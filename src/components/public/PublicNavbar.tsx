/**
 * Chaos Computer Club Medi-Caps
 * src/components/public/PublicNavbar.tsx — Accessible Public Header for Informational & Legal Pages
 */

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ArrowRight, ShieldCheck } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

export function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isAuth = isAuthenticated();

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Data Deletion", href: "/data-deletion" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 rounded-md p-1"
          aria-label="Chaos Computer Club Medi-Caps Homepage"
        >
          <img
            src="/logo.webp"
            alt="Chaos Computer Club"
            className="h-8 w-8 object-contain"
          />
          <div className="flex flex-col leading-none">
            <span className="font-sans text-sm font-bold tracking-tight text-white">
              Chaos Computer Club Medi-Caps
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-lime-400 mt-0.5">
              Medi-Caps University Chapter
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Public navigation" className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const active = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`text-xs font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 rounded px-1.5 py-1 ${
                  active ? "text-lime-400 font-semibold" : "text-zinc-400"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA Actions */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuth ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-lime-400/40 bg-lime-400/10 px-3.5 py-1.5 font-mono text-xs font-semibold text-lime-400 transition-all hover:bg-lime-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-all hover:border-white/30 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <span>Cadet Sign In</span>
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 rounded-md bg-lime-400 px-3.5 py-1.5 text-xs font-semibold text-black transition-all hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Enter Arena</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 rounded-md"
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-black px-4 py-4 space-y-3">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const active = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm py-2 px-3 rounded-md transition-colors ${
                    active ? "bg-white/[0.06] text-lime-400 font-semibold" : "text-zinc-300 hover:bg-white/[0.03]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
            {isAuth ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center rounded-md bg-lime-400 py-2.5 font-mono text-xs font-semibold text-black"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-md border border-white/20 bg-zinc-900 py-2 text-xs font-medium text-white"
                >
                  Cadet Sign In
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-md bg-lime-400 py-2 text-xs font-semibold text-black"
                >
                  Enter Arena
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
