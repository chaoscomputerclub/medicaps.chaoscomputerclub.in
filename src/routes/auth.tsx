/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Strict Redux Toolkit global state management.
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Chrome, Loader2, Mail, ArrowLeft, ShieldAlert, AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthLayout } from "@/organization/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setEmail,
  setOtp,
  setName,
  setHandle,
  setPrn,
  setDepartment,
  setBatch,
  setStep,
  setMessage,
  setTokenDirect,
  sendOtpThunk,
  verifyOtpThunk,
  completeOnboardingThunk,
  fetchCurrentUserThunk,
} from "@/store/slices/authSlice";
import { getGoogleLoginURL, isMedicapsEmail } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — CCC Medi-Caps" },
      {
        name: "description",
        content: "Sign in to the CCC Medi-Caps offline contest portal.",
      },
      { property: "og:title", content: "CCC Medi-Caps Member Sign In" },
      {
        property: "og:description",
        content:
          "Institutional access to campus contests, ratings and verified records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});


function checkIsMedicapsEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain === "medicaps.ac.in" || Boolean(domain?.endsWith(".medicaps.ac.in"));
}

function Auth() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Strict Redux Toolkit state selectors
  const {
    step,
    email,
    transactionId,
    otp,
    name,
    handle,
    prn,
    department,
    batch,
    pending,
    message,
    devOtp,
    isAuthenticated: authed,
  } = useAppSelector((state) => state.auth);

  // Live real-time domain inspection
  const cleanEmail = email.trim().toLowerCase();
  const hasAt = cleanEmail.includes("@");
  const typedDomain = hasAt ? cleanEmail.split("@")[1] || "" : "";
  const isInvalidDomain = hasAt && typedDomain.length > 0 && !checkIsMedicapsEmail(cleanEmail);


  // Check URL query parameters (Google OAuth callback) & session validation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const onboardedParam = params.get("is_onboarded") ?? params.get("onboarding");
    const emailParam = params.get("email");

    const errorParam = params.get("error");
    if (errorParam) {
      if (errorParam === "unauthorized_domain") {
        const rejectedEmail = params.get("email");
        dispatch(
          setMessage(
            rejectedEmail
              ? `Access restricted: ${rejectedEmail} is not a Medi-Caps institutional account. Only official @medicaps.ac.in organization emails are permitted. Gmail and external companies are strictly blocked.`
              : "Access restricted: Only official @medicaps.ac.in organization emails are permitted. Gmail and personal accounts are not allowed."
          )
        );
      } else if (errorParam === "google_cancelled") {
        dispatch(setMessage("Google sign-in was cancelled."));
      } else {
        dispatch(setMessage("Google authentication failed. Please try again or use institutional email verification."));
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (tokenParam) {
      dispatch(setTokenDirect(tokenParam));
      if (emailParam) dispatch(setEmail(emailParam));
      window.history.replaceState({}, document.title, window.location.pathname);

      if (onboardedParam === "true" || onboardedParam === "0") {
        void navigate({ to: "/portal" });
        return;
      } else {
        dispatch(setStep("onboarding"));
        return;
      }
    }

    if (authed) {
      dispatch(fetchCurrentUserThunk())
        .unwrap()
        .then((m) => {
          if (m.is_onboarded) {
            void navigate({ to: "/portal" });
          } else {
            if (m.email) dispatch(setEmail(m.email));
            if (m.full_name) dispatch(setName(m.full_name));
            if (m.handle) dispatch(setHandle(m.handle));
            dispatch(setStep("onboarding"));
          }
        })
        .catch(() => {});
    }
  }, [dispatch, navigate, authed]);

  // Step 1: Send OTP via Redux Thunk (Restricted strictly to @medicaps.ac.in)
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      dispatch(setMessage("Please enter your university email address."));
      return;
    }
    if (!checkIsMedicapsEmail(clean)) {
      dispatch(
        setMessage(
          "Access restricted: Only @medicaps.ac.in organization emails are permitted. Gmail, Yahoo, and personal accounts are strictly prohibited."
        )
      );
      return;
    }
    await dispatch(sendOtpThunk(clean));
  }

  // Step 2: Verify OTP via Redux Thunk
  async function triggerVerify(codeToVerify: string) {
    if (!codeToVerify || codeToVerify.length !== 6) return;
    const resultAction = await dispatch(
      verifyOtpThunk({
        email,
        code: codeToVerify,
        transaction_id: transactionId || undefined,
      })
    );
    if (verifyOtpThunk.fulfilled.match(resultAction)) {
      const res = resultAction.payload;
      if (!res.is_new_user && res.member?.is_onboarded) {
        void navigate({ to: "/portal" });
      }
    }
  }

  function handleVerifyOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    void triggerVerify(otp);
  }

  async function handleResendOtp() {
    const clean = email.trim().toLowerCase();
    if (!clean || !checkIsMedicapsEmail(clean)) {
      dispatch(setMessage("Only @medicaps.ac.in organization emails are permitted."));
      return;
    }
    await dispatch(sendOtpThunk(clean));
  }

  // Step 3: Complete Onboarding via Redux Thunk
  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fallbackHandle = email.split("@")[0] || "user";
    const h = (handle.trim() || fallbackHandle).toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!name.trim()) {
      dispatch(setMessage("Full name is required."));
      return;
    }
    if (!prn.trim()) {
      dispatch(setMessage("University PRN is required."));
      return;
    }

    const resultAction = await dispatch(
      completeOnboardingThunk({
        handle: h,
        full_name: name.trim(),
        prn: prn.trim().toUpperCase(),
        department,
        batch,
      })
    );

    if (completeOnboardingThunk.fulfilled.match(resultAction)) {
      void navigate({ to: "/portal" });
    }
  }

  function handleGoogle() {
    window.location.href = getGoogleLoginURL();
  }

  let title = "Enter member operations";
  let description =
    "Campus credentials unlock registrations, issued passes, private rating history, and attendance-backed proofs.";

  if (step === "otp") {
    title = "Verify authentication code";
    description = `Enter the six-digit code sent to ${email}.`;
  } else if (step === "onboarding") {
    title = "Complete member registration";
    description =
      "First-time registration detected. Set your academic parameters to initialize your portal credential.";
  }

  return (
    <AuthLayout title={title} description={description}>
      {step === "email" && (
        <>
          {/* Institutional Perimeter Status Banner */}
          <div className="border border-border/80 bg-[#0a0a0c] p-3 mb-4 rounded-none">
            <div className="flex items-center justify-between font-mono text-[0.6875rem] text-[#ccff00] uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="size-3.5 text-[#ccff00]" />
                [ GATEWAY // INSTITUTIONAL ACCESS ]
              </span>
              <span className="text-[0.625rem] text-[#ccff00] border border-[#ccff00]/40 px-1.5 py-0.5 font-semibold">
                ENFORCED
              </span>
            </div>
            <p className="font-mono text-[0.6875rem] text-zinc-400 leading-relaxed">
              Access is restricted strictly to official <strong className="text-zinc-200">@medicaps.ac.in</strong> credentials. Commercial providers (<span className="text-zinc-500 line-through">Gmail</span>, <span className="text-zinc-500 line-through">Yahoo</span>, <span className="text-zinc-500 line-through">Outlook</span>) are blocked by the firewall.
            </p>
          </div>

          <form className="auth-form space-y-4" onSubmit={handleEmailSubmit}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="email" className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Institutional email address
                </Label>
                <span className="font-mono text-[0.625rem] text-[#ccff00] font-semibold tracking-wider uppercase">
                  @medicaps.ac.in only
                </span>
              </div>
              <div className="input-icon">
                <Mail className="size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    dispatch(setEmail(e.target.value));
                    if (message) dispatch(setMessage(null));
                  }}
                  placeholder="name@medicaps.ac.in"
                  required
                  autoFocus
                  className={cn(
                    "font-mono text-sm",
                    isInvalidDomain && "border-amber-500/80 focus-visible:ring-amber-500 text-amber-200 bg-amber-950/10"
                  )}
                />
              </div>
            </div>

            {/* Realtime Live Domain Warning */}
            {isInvalidDomain && (
              <div className="p-3 border border-amber-500/40 bg-amber-950/20 text-amber-300 font-mono text-xs leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold tracking-wider uppercase text-[0.6875rem]">
                  <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                  <span>[ 403 // FORBIDDEN DOMAIN: @{typedDomain} ]</span>
                </div>
                <p className="text-[0.6875rem] text-amber-200/90 leading-relaxed">
                  Personal accounts are blocked by policy. Please switch to your registered <strong className="text-white">@medicaps.ac.in</strong> email address.
                </p>
              </div>
            )}

            {/* General Rejection / Auth Message Banner */}
            {message && !isInvalidDomain && (
              <div className="p-3 border border-red-500/50 bg-red-950/30 text-red-300 font-mono text-xs leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 text-red-400 font-bold tracking-wider uppercase text-[0.6875rem]">
                  <ShieldAlert className="size-3.5 text-red-400 shrink-0" />
                  <span>[ SECURITY RESTRICTION ]</span>
                </div>
                <p className="text-[0.6875rem] text-red-200 leading-relaxed">
                  {message}
                </p>
              </div>
            )}

            <Button
              className="w-full font-mono text-xs uppercase tracking-wider h-10 font-semibold disabled:opacity-50"
              disabled={pending || isInvalidDomain}
              type="submit"
            >
              {pending ? (
                <Loader2 className="spin size-4" />
              ) : isInvalidDomain ? (
                "Enter @medicaps.ac.in Address"
              ) : (
                "Continue with Email OTP"
              )}
            </Button>
          </form>

          <div className="auth-divider my-4">
            <span>or</span>
          </div>

          <Button
            type="button"
            className="w-full font-mono text-xs tracking-wider h-10 border-border/80 hover:border-[#ccff00]/40 transition-colors"
            variant="outline"
            onClick={handleGoogle}
            disabled={pending}
          >
            <Chrome className="size-4 mr-2 text-[#ccff00]" /> Continue with Medi-Caps Google Workspace
          </Button>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-center gap-2 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-wider">
            <Lock className="size-3 text-[#ccff00]" />
            <span>Medi-Caps University Realm &bull; Open By Default &bull; Peer Driven</span>
          </div>
        </>
      )}

      {step === "otp" && (
        <form className="auth-form space-y-4" onSubmit={handleVerifyOtpSubmit}>
          <div>
            <Label htmlFor="otp" className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              Authentication code
            </Label>
            <div className="mt-3 flex justify-center">
              <InputOTP
                id="otp"
                maxLength={6}
                value={otp}
                onChange={(val) => {
                  dispatch(setOtp(val));
                  if (val.length === 6) {
                    setTimeout(() => {
                      void triggerVerify(val);
                    }, 50);
                  }
                }}
                autoFocus
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="size-11 rounded-none border-border bg-background font-mono text-base tabular-nums"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="mt-2.5 flex items-center justify-between font-mono text-[0.625rem] text-muted-foreground">
              <span>Six digits · expires in 10 minutes</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={pending}
                className="hover:text-accent transition-colors underline-offset-4 hover:underline cursor-pointer"
              >
                Resend code
              </button>
            </div>
          </div>

          {devOtp && (
            <div className="border border-dashed border-accent/40 bg-accent/10 px-3 py-2 text-center font-mono text-xs text-accent">
              <span>[DEV OTP] {devOtp}</span>
            </div>
          )}

          {message && (
            <div className="p-3 border border-red-500/50 bg-red-950/30 text-red-300 font-mono text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 text-red-400 font-bold tracking-wider uppercase text-[0.6875rem]">
                <ShieldAlert className="size-3.5 text-red-400 shrink-0" />
                <span>[ AUTHENTICATION ERROR ]</span>
              </div>
              <p className="text-[0.6875rem] text-red-200 leading-relaxed">
                {message}
              </p>
            </div>
          )}

          <Button
            className="w-full font-mono text-xs uppercase tracking-wider h-10 font-semibold"
            disabled={pending || otp.length < 6}
            type="submit"
          >
            {pending ? <Loader2 className="spin size-4" /> : "Continue"}
          </Button>

          <button
            type="button"
            onClick={() => {
              dispatch(setStep("email"));
              dispatch(setOtp(""));
              dispatch(setMessage(null));
            }}
            className="flex items-center justify-center gap-1.5 w-full text-center font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-accent cursor-pointer pt-1"
          >
            <ArrowLeft className="size-3" /> Use another email address
          </button>
        </form>
      )}

      {step === "onboarding" && (
        <form className="auth-form space-y-4" onSubmit={handleOnboardingSubmit}>
          <div>
            <Label htmlFor="ob-name" className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              Full name
            </Label>
            <Input
              id="ob-name"
              value={name}
              onChange={(e) => dispatch(setName(e.target.value))}
              placeholder="Ada Lovelace"
              required
              autoFocus
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label htmlFor="ob-handle" className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              Member handle / alias
            </Label>
            <Input
              id="ob-handle"
              value={handle}
              onChange={(e) =>
                dispatch(
                  setHandle(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  )
                )
              }
              placeholder="ada_core"
              required
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label htmlFor="ob-prn" className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              University PRN
            </Label>
            <Input
              id="ob-prn"
              value={prn}
              onChange={(e) => dispatch(setPrn(e.target.value.toUpperCase()))}
              placeholder="0827CS221184"
              required
              pattern="[A-Z0-9]{8,16}"
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div className="auth-selects">
            <div>
              <Label className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">Department</Label>
              <Select value={department} onValueChange={(val) => dispatch(setDepartment(val))}>
                <SelectTrigger className="mt-1 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSE">CSE</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="AIDS">AIDS</SelectItem>
                  <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                  <SelectItem value="ECE">ECE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">Batch</Label>
              <Select value={batch} onValueChange={(val) => dispatch(setBatch(val))}>
                <SelectTrigger className="mt-1 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2022-26">2022–26</SelectItem>
                  <SelectItem value="2023-27">2023–27</SelectItem>
                  <SelectItem value="2024-28">2024–28</SelectItem>
                  <SelectItem value="2025-29">2025–29</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {message && (
            <div className="p-3 border border-red-500/50 bg-red-950/30 text-red-300 font-mono text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 text-red-400 font-bold tracking-wider uppercase text-[0.6875rem]">
                <ShieldAlert className="size-3.5 text-red-400 shrink-0" />
                <span>[ AUTHENTICATION ERROR ]</span>
              </div>
              <p className="text-[0.6875rem] text-red-200 leading-relaxed">
                {message}
              </p>
            </div>
          )}

          <Button className="w-full font-mono text-xs uppercase tracking-wider h-10 font-semibold" disabled={pending} type="submit">
            {pending ? <Loader2 className="spin size-4" /> : "Continue"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
