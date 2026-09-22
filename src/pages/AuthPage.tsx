/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Strix-layout × CCC Lime Theme — Production Auth Experience.
 * Strict Redux Toolkit global state management.
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { preloadFullProfile } from "@/organization/data/queries";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthLayout } from "@/organization/components/AuthLayout";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setEmail,
  setOtp,
  setName,
  setHandle,
  setStep,
  setMessage,
  setTokenDirect,
  sendOtpThunk,
  verifyOtpThunk,
  completeOnboardingThunk,
  fetchCurrentUserThunk,
  checkHandleThunk,
  setHandleStatus,
} from "@/store/slices/authSlice";
import { getGoogleLoginURL } from "@/lib/auth";

// ─────────────────────────────────────────────
// SVG icons
// ─────────────────────────────────────────────

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );
}



// ─────────────────────────────────────────────
// Shared input style (recessed dark)
// ─────────────────────────────────────────────
const INPUT_BASE =
  "w-full h-11 rounded-lg border border-white/[0.09] bg-[#0d0d0f] px-3.5 text-sm text-white placeholder:text-zinc-600 " +
  "focus:outline-none focus:border-[#CCFF00]/60 focus:ring-2 focus:ring-[#CCFF00]/20 transition-all duration-150";

// ─────────────────────────────────────────────
// Shared label style
// ─────────────────────────────────────────────
const LABEL = "block text-xs font-medium text-zinc-400 mb-2";

// ─────────────────────────────────────────────
// Lime primary button
// ─────────────────────────────────────────────
const BTN_PRIMARY =
  "w-full h-11 rounded-lg bg-[#CCFF00] text-black text-sm font-semibold " +
  "hover:bg-[#b8e600] active:scale-[0.99] transition-all duration-150 " +
  "flex items-center justify-center cursor-pointer " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

// ─────────────────────────────────────────────
// Secondary (OAuth / outline) button
// ─────────────────────────────────────────────
const BTN_SECONDARY =
  "w-full h-11 rounded-lg border border-white/[0.09] bg-transparent text-sm font-medium text-zinc-300 " +
  "hover:bg-white/[0.04] hover:border-white/20 transition-all duration-150 " +
  "flex items-center justify-center gap-2.5 cursor-pointer " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

// ─────────────────────────────────────────────
// Domain guard
// ─────────────────────────────────────────────
function checkIsMedicapsEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain === "medicaps.ac.in" || Boolean(domain?.endsWith(".medicaps.ac.in"));
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export function AuthPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const {
    step,
    email,
    transactionId,
    otp,
    name,
    handle,
    pending,
    message,
    devOtp,
    isAuthenticated: authed,
    handleStatus,
  } = useAppSelector((s) => s.auth);

  const cleanEmail = email.trim().toLowerCase();
  const hasAt = cleanEmail.includes("@");
  const typedDomain = hasAt ? cleanEmail.split("@")[1] || "" : "";
  const isInvalidDomain = hasAt && typedDomain.length > 0 && !checkIsMedicapsEmail(cleanEmail);

  // ── Google OAuth callback & session rehydration ──────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const onboardedParam = params.get("is_onboarded") ?? params.get("onboarding");
    const emailParam = params.get("email");
    const errorParam = params.get("error");

    if (errorParam) {
      if (errorParam === "unauthorized_domain") {
        const rej = params.get("email");
        dispatch(setMessage(
          rej
            ? `${rej} is not a Medi-Caps account. Only @medicaps.ac.in emails are permitted.`
            : "Only official @medicaps.ac.in organization emails are permitted.",
        ));
      } else if (errorParam === "google_cancelled") {
        dispatch(setMessage("Google sign-in was cancelled."));
      } else {
        dispatch(setMessage("Google authentication failed. Please try again."));
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (tokenParam) {
      dispatch(setTokenDirect(tokenParam));
      if (emailParam) dispatch(setEmail(emailParam));
      window.history.replaceState({}, document.title, window.location.pathname);
      const isOnboarded =
        onboardedParam === "true" || onboardedParam === "0" || params.get("onboarding") === "0";
      if (isOnboarded) {
        void preloadFullProfile(tokenParam).then(() => navigate("/"));
      } else {
        dispatch(setStep("onboarding"));
      }
      return;
    }

    if (authed) {
      dispatch(fetchCurrentUserThunk()).unwrap().then((m) => {
        if (m.is_onboarded) {
          navigate("/");
        } else {
          if (m.email) dispatch(setEmail(m.email));
          if (m.full_name) dispatch(setName(m.full_name));
          if (m.handle) dispatch(setHandle(m.handle));
          dispatch(setStep("onboarding"));
        }
      }).catch(() => {});
    }
  }, [dispatch, navigate, authed]);

  // ── Handle availability debounce ──────────────────────────────────
  useEffect(() => {
    if (step !== "onboarding") return;
    const clean = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!clean || clean.length < 3) { dispatch(setHandleStatus("idle")); return; }
    dispatch(setHandleStatus("checking"));
    const t = setTimeout(() => dispatch(checkHandleThunk(clean)), 450);
    return () => clearTimeout(t);
  }, [handle, step, dispatch]);

  // ── Step 1: send OTP ─────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      dispatch(setMessage("Please enter your university email address.")); return;
    }
    if (!checkIsMedicapsEmail(clean)) {
      dispatch(setMessage("Only @medicaps.ac.in organization emails are permitted.")); return;
    }
    await dispatch(sendOtpThunk(clean));
  }

  // ── Step 2: verify OTP ───────────────────────────────────────────
  async function triggerVerify(code: string) {
    if (!code || code.length !== 6) return;
    const result = await dispatch(verifyOtpThunk({ email, code, transaction_id: transactionId || "" }));
    if (verifyOtpThunk.fulfilled.match(result)) {
      const res = result.payload;
      if (!res.is_new_user && res.member?.is_onboarded) {
        await preloadFullProfile(res.access_token);
        navigate("/");
      }
    }
  }

  function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    void triggerVerify(otp);
  }

  async function handleResendOtp() {
    const clean = email.trim().toLowerCase();
    if (!clean || !checkIsMedicapsEmail(clean)) {
      dispatch(setMessage("Only @medicaps.ac.in emails are permitted.")); return;
    }
    await dispatch(sendOtpThunk(clean));
    toast.success("New code sent to your inbox.");
  }

  // ── Step 3: onboarding ───────────────────────────────────────────
  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fallback = email.split("@")[0] || "user";
    const h = (handle.trim() || fallback).toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!name.trim()) { dispatch(setMessage("Full name is required.")); return; }
    if (h.length < 3) { dispatch(setMessage("Handle must be at least 3 characters.")); return; }
    if (handleStatus === "taken") { dispatch(setMessage("This handle is already taken.")); return; }
    const result = await dispatch(completeOnboardingThunk({ handle: h, full_name: name.trim() }));
    if (completeOnboardingThunk.fulfilled.match(result)) {
      await preloadFullProfile();
      navigate("/");
    }
  }

  // ── Derive layout props ──────────────────────────────────────────
  let layoutTitle: string;
  let layoutSubtitle: React.ReactNode | undefined;

  if (step === "otp") {
    layoutTitle = "Check your email";
    layoutSubtitle = (
      <>
        Enter the code sent to{" "}
        <span className="font-medium text-white">{email}</span>
      </>
    );
  } else if (step === "onboarding") {
    layoutTitle = "Complete your profile";
    layoutSubtitle = "Choose your display name and campus handle.";
  } else {
    layoutTitle = "Sign in";
    layoutSubtitle = undefined;
  }

  return (
    <AuthLayout title={layoutTitle} subtitle={layoutSubtitle}>

      {/* ════════════════════════════════════════════
          STEP 1 — Email + OAuth
          ════════════════════════════════════════════ */}
      {step === "email" && (
        <div>
          <form onSubmit={handleEmailSubmit} noValidate>
            {/* Email field */}
            <label htmlFor="auth-email" className={LABEL}>
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => {
                dispatch(setEmail(e.target.value));
                if (message) dispatch(setMessage(null));
              }}
              placeholder="Your email address"
              required
              autoFocus
              autoComplete="email"
              className={cn(
                INPUT_BASE,
                isInvalidDomain && "border-amber-500/50 focus:border-amber-500/70 focus:ring-amber-500/20",
              )}
            />

            {/* Domain warning */}
            {isInvalidDomain && (
              <p className="mt-2 text-xs text-amber-400">
                Please use your official <span className="font-medium text-amber-300">@medicaps.ac.in</span> email.
              </p>
            )}

            {/* General error */}
            {message && !isInvalidDomain && (
              <p className="mt-2 text-xs text-red-400 leading-relaxed">{message}</p>
            )}

            {/* Primary CTA — lime */}
            <button
              type="submit"
              disabled={pending || isInvalidDomain}
              className={cn(BTN_PRIMARY, "mt-3.5")}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Continue with email"}
            </button>
          </form>

          {/* OR hairline divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.07]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#161618] px-3 text-[11px] font-medium uppercase tracking-widest text-zinc-600 select-none">
                or
              </span>
            </div>
          </div>

          {/* OAuth button */}
          <div>
            <button
              type="button"
              onClick={() => { window.location.href = getGoogleLoginURL(); }}
              disabled={pending}
              className={BTN_SECONDARY}
            >
              <GoogleIcon className="size-4 shrink-0" />
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          STEP 2 — OTP verification
          ════════════════════════════════════════════ */}
      {step === "otp" && (
        <form onSubmit={handleVerifySubmit}>
          {/* OTP slot grid — centered */}
          <div className="flex justify-center">
            <InputOTP
              id="auth-otp"
              maxLength={6}
              value={otp}
              onChange={(val) => {
                dispatch(setOtp(val));
                if (val.length === 6) setTimeout(() => void triggerVerify(val), 50);
              }}
              autoFocus
            >
              <InputOTPGroup className="gap-2.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className={cn(
                      "size-11 rounded-xl border border-white/[0.09] bg-[#0d0d0f]",
                      "font-mono text-base tabular-nums text-white",
                      "transition-all duration-150",
                      "data-[active=true]:border-[#CCFF00]/70 data-[active=true]:ring-2 data-[active=true]:ring-[#CCFF00]/20",
                    )}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Dev OTP hint */}
          {devOtp && (
            <p className="mt-4 text-center font-mono text-xs text-[#CCFF00]/70">
              Dev code: <span className="text-[#CCFF00] font-semibold">{devOtp}</span>
            </p>
          )}

          {/* Error */}
          {message && (
            <p className="mt-3 text-center text-xs text-red-400">{message}</p>
          )}

          {/* Verify — lime */}
          <button
            type="submit"
            disabled={pending || otp.length < 6}
            className={cn(BTN_PRIMARY, "mt-5")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Verify and continue"}
          </button>

          {/* Didn't receive / back */}
          <div className="mt-5 text-center space-y-1.5">
            <p className="text-xs text-zinc-500">
              Didn't receive a code?{" "}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={pending}
                className="font-medium text-[#CCFF00] hover:text-[#b8e600] transition-colors cursor-pointer disabled:opacity-40"
              >
                Resend
              </button>
            </p>
            <button
              type="button"
              onClick={() => {
                dispatch(setStep("email"));
                dispatch(setOtp(""));
                dispatch(setMessage(null));
              }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
            >
              ← Change email
            </button>
          </div>
        </form>
      )}

      {/* ════════════════════════════════════════════
          STEP 3 — Profile onboarding
          ════════════════════════════════════════════ */}
      {step === "onboarding" && (
        <form onSubmit={handleOnboardingSubmit} className="space-y-4">
          {/* Full name */}
          <div>
            <label htmlFor="ob-name" className={LABEL}>
              Full name
            </label>
            <input
              id="ob-name"
              value={name}
              onChange={(e) => { dispatch(setName(e.target.value)); if (message) dispatch(setMessage(null)); }}
              placeholder="Ada Lovelace"
              required
              autoFocus
              className={INPUT_BASE}
            />
          </div>

          {/* Campus handle */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="ob-handle" className="text-xs font-medium text-zinc-400">
                Campus handle
              </label>
              <span className="flex items-center gap-1 text-xs">
                {handleStatus === "checking" && (
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> checking…
                  </span>
                )}
                {handleStatus === "available" && (
                  <span className="text-[#CCFF00] flex items-center gap-1 font-medium">
                    <Check size={12} /> available
                  </span>
                )}
                {handleStatus === "taken" && (
                  <span className="text-red-400 flex items-center gap-1 font-medium">
                    <X size={12} /> taken
                  </span>
                )}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 select-none text-sm text-zinc-600">
                @
              </span>
              <input
                id="ob-handle"
                value={handle}
                onChange={(e) => {
                  dispatch(setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")));
                  if (message) dispatch(setMessage(null));
                }}
                placeholder="handle"
                required
                className={cn(
                  INPUT_BASE, "pl-8",
                  handleStatus === "available" && "border-[#CCFF00]/40 focus:border-[#CCFF00]/70",
                  handleStatus === "taken" && "border-red-500/40 focus:border-red-500/70 focus:ring-red-500/20",
                )}
              />
            </div>
          </div>

          {/* Error */}
          {message && (
            <p className="text-xs text-red-400 font-medium">{message}</p>
          )}

          {/* Submit — lime */}
          <button
            type="submit"
            disabled={
              pending || !name.trim() || handle.trim().length < 3 ||
              handleStatus === "taken" || handleStatus === "checking"
            }
            className={cn(BTN_PRIMARY, "mt-2")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Enter CCC Arena"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
