/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Strict Redux Toolkit global state management.
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { preloadFullProfile } from "@/organization/data/queries";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, Mail, ArrowLeft, ShieldAlert, AlertTriangle } from "lucide-react";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

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
        content: "Institutional access to campus contests, ratings and verified records.",
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
              : "Access restricted: Only official @medicaps.ac.in organization emails are permitted. Gmail and personal accounts are not allowed.",
          ),
        );
      } else if (errorParam === "google_cancelled") {
        dispatch(setMessage("Google sign-in was cancelled."));
      } else {
        dispatch(
          setMessage(
            "Google authentication failed. Please try again or use institutional email verification.",
          ),
        );
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (tokenParam) {
      dispatch(setTokenDirect(tokenParam));
      if (emailParam) dispatch(setEmail(emailParam));
      window.history.replaceState({}, document.title, window.location.pathname);

      if (onboardedParam === "true" || onboardedParam === "0") {
        void (async () => {
          await preloadFullProfile(tokenParam);
          void navigate({ to: "/portal" });
        })();
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
          "Access restricted: Only @medicaps.ac.in organization emails are permitted. Gmail, Yahoo, and personal accounts are strictly prohibited.",
        ),
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
        transaction_id: transactionId || "",
      }),
    );
    if (verifyOtpThunk.fulfilled.match(resultAction)) {
      const res = resultAction.payload;
      if (!res.is_new_user && res.member?.is_onboarded) {
        await preloadFullProfile(res.access_token);
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
      }),
    );

    if (completeOnboardingThunk.fulfilled.match(resultAction)) {
      await preloadFullProfile();
      void navigate({ to: "/portal" });
    }
  }

  function handleGoogle() {
    window.location.href = getGoogleLoginURL();
  }

  let title: React.ReactNode = (
    <>
      <span className="block whitespace-nowrap">ENTER</span>
      <span className="block whitespace-nowrap">MEMBER</span>
      <span className="block whitespace-nowrap">OPERATIONS</span>
    </>
  );
  let description: React.ReactNode = null;

  if (step === "otp") {
    title = (
      <>
        <span className="block whitespace-nowrap">VERIFY</span>
        <span className="block whitespace-nowrap">AUTHENTICATION</span>
        <span className="block whitespace-nowrap">CODE</span>
      </>
    );
    description = `Enter the six-digit code sent to ${email}.`;
  } else if (step === "onboarding") {
    title = (
      <>
        <span className="block whitespace-nowrap">COMPLETE</span>
        <span className="block whitespace-nowrap">MEMBER</span>
        <span className="block whitespace-nowrap">REGISTRATION</span>
      </>
    );
    description =
      "Set your academic parameters to initialize your portal credential.";
  }

  return (
    <AuthLayout title={title} description={description}>
      {step === "email" && (
        <>
          <form className="auth-form space-y-4" onSubmit={handleEmailSubmit}>
            <div>
              <Label
                htmlFor="email"
                className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground block mb-1.5"
              >
                Email address
              </Label>
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
                    "font-mono text-sm h-10",
                    isInvalidDomain &&
                      "border-amber-500/80 focus-visible:ring-amber-500 text-amber-200 bg-amber-950/10",
                  )}
                />
              </div>
            </div>

            {/* Realtime Live Domain Warning */}
            {isInvalidDomain && (
              <div className="p-3 border border-amber-500/40 bg-amber-950/20 text-xs leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[0.6875rem] text-amber-200/90 leading-relaxed">
                  Please use your registered <strong className="text-white">@medicaps.ac.in</strong> email address.
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
                <p className="text-[0.6875rem] text-red-200 leading-relaxed">{message}</p>
              </div>
            )}

            <Button
              className="w-full font-mono text-xs uppercase tracking-wider h-11 font-semibold rounded-none bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer disabled:opacity-50"
              disabled={pending || isInvalidDomain}
              type="submit"
            >
              {pending ? (
                <Loader2 className="spin size-4" />
              ) : (
                "Continue with Email OTP"
              )}
            </Button>
          </form>

          {/* Divider: ---- or ---- */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/80" />
            <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-muted-foreground/70 select-none">
              or
            </span>
            <div className="h-px flex-1 bg-border/80" />
          </div>

          <button
            type="button"
            className="w-full h-11 px-4 font-sans text-xs sm:text-sm font-medium border border-border/80 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-500 text-zinc-200 hover:text-white transition-all flex items-center justify-center gap-2.5 rounded-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            onClick={handleGoogle}
            disabled={pending}
          >
            <GoogleIcon className="size-4 shrink-0" />
            <span className="tracking-wide">Continue with Google</span>
          </button>
        </>
      )}

      {step === "otp" && (
        <form className="auth-form space-y-4" onSubmit={handleVerifyOtpSubmit}>
          <div>
            <Label
              htmlFor="otp"
              className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground"
            >
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
              <p className="text-[0.6875rem] text-red-200 leading-relaxed">{message}</p>
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
            <Label
              htmlFor="ob-name"
              className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground"
            >
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
            <Label
              htmlFor="ob-handle"
              className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground"
            >
              Member handle / alias
            </Label>
            <Input
              id="ob-handle"
              value={handle}
              onChange={(e) =>
                dispatch(setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")))
              }
              placeholder="ada_core"
              required
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label
              htmlFor="ob-prn"
              className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground"
            >
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
              <Label className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Department
              </Label>
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
              <Label className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Batch
              </Label>
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
              <p className="text-[0.6875rem] text-red-200 leading-relaxed">{message}</p>
            </div>
          )}

          <Button
            className="w-full font-mono text-xs uppercase tracking-wider h-10 font-semibold"
            disabled={pending}
            type="submit"
          >
            {pending ? <Loader2 className="spin size-4" /> : "Continue"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
