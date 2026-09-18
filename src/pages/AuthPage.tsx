/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Strict Redux Toolkit global state management.
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { preloadFullProfile } from "@/organization/data/queries";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Loader2, Mail, ArrowLeft, ShieldAlert, AlertTriangle, Check, X } from "lucide-react";
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
  checkHandleThunk,
  setHandleStatus,
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


function checkIsMedicapsEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain === "medicaps.ac.in" || Boolean(domain?.endsWith(".medicaps.ac.in"));
}

export function AuthPage() {
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
    handleStatus,
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

      const isOnboarded =
        onboardedParam === "true" ||
        onboardedParam === "0" ||
        params.get("onboarding") === "0";

      if (isOnboarded) {
        void (async () => {
          await preloadFullProfile(tokenParam);
          navigate("/portal");
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
            navigate("/portal");
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

  // Real-time debounced handle availability check (450ms)
  useEffect(() => {
    if (step !== "onboarding") return;
    const clean = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!clean || clean.length < 3) {
      dispatch(setHandleStatus("idle"));
      return;
    }
    dispatch(setHandleStatus("checking"));
    const timer = setTimeout(() => {
      dispatch(checkHandleThunk(clean));
    }, 450);
    return () => clearTimeout(timer);
  }, [handle, step, dispatch]);

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
        navigate("/portal");
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

  // Step 3: Complete Onboarding via Redux Thunk (minimal 2-field registration)
  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fallbackHandle = email.split("@")[0] || "user";
    const h = (handle.trim() || fallbackHandle).toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!name.trim()) {
      dispatch(setMessage("Full name is required."));
      return;
    }
    if (h.length < 3) {
      dispatch(setMessage("Handle must be at least 3 characters."));
      return;
    }
    if (handleStatus === "taken") {
      dispatch(setMessage("This handle is already taken. Choose another."));
      return;
    }

    const resultAction = await dispatch(
      completeOnboardingThunk({
        handle: h,
        full_name: name.trim(),
      }),
    );

    if (completeOnboardingThunk.fulfilled.match(resultAction)) {
      await preloadFullProfile();
      navigate("/portal");
    }
  }

  function handleGoogle() {
    window.location.href = getGoogleLoginURL();
  }

  let kicker = "00 // Identity Gate";
  let index = "INDEX 0.0 · CREDENTIAL ENTRY";
  let title: React.ReactNode = (
    <>
      <span className="block whitespace-nowrap">ENTER</span>
      <span className="block whitespace-nowrap">MEMBER</span>
      <span className="block whitespace-nowrap">OPERATIONS</span>
    </>
  );
  let description: React.ReactNode = null;

  if (step === "otp") {
    kicker = "00 // Identity Verification";
    index = "INDEX 0.1 · OTP VERIFICATION";
    title = (
      <>
        <span className="block whitespace-nowrap">VERIFY</span>
        <span className="block whitespace-nowrap">AUTHENTICATION</span>
        <span className="block whitespace-nowrap">CODE</span>
      </>
    );
    description = `Enter the six-digit code sent to ${email}.`;
  } else if (step === "onboarding") {
    kicker = "00 // Member Onboarding";
    index = "INDEX 0.2 · CADET REGISTRATION";
    title = (
      <>
        <span className="block whitespace-nowrap">COMPLETE</span>
        <span className="block whitespace-nowrap">MEMBER</span>
        <span className="block whitespace-nowrap">REGISTRATION</span>
      </>
    );
    description =
      "Choose your display name and handle to initialize your portal credential.";
  }

  return (
    <AuthLayout kicker={kicker} index={index} title={title} description={description}>
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
              className="w-full font-mono text-xs uppercase tracking-wider h-11 font-semibold rounded-none bg-lime-400 text-black font-bold hover:bg-lime-400 cursor-pointer disabled:opacity-50 transition-colors"
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
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-zinc-500 select-none">
              or
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            className="w-full h-11 px-4 font-sans text-xs sm:text-sm font-medium border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-500 text-zinc-200 hover:text-white transition-all flex items-center justify-center gap-2.5 rounded-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
              className="font-mono text-[0.625rem] uppercase tracking-wider text-zinc-400"
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
                <InputOTPGroup className="gap-2 sm:gap-2.5">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="size-11 rounded-none border border-white/10 bg-zinc-900/60 font-mono text-base tabular-nums focus:border-lime-400 focus:ring-1 focus:ring-lime-400 text-white"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="mt-2.5 flex items-center justify-between font-mono text-[0.625rem] text-zinc-400">
              <span>Six digits · expires in 10 minutes</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={pending}
                className="hover:text-lime-400 transition-colors underline-offset-4 hover:underline cursor-pointer"
              >
                Resend code
              </button>
            </div>
          </div>

          {devOtp && (
            <div className="border border-dashed border-lime-400/40 bg-lime-400/10 px-3 py-2 text-center font-mono text-xs text-lime-400 rounded-none">
              <span>[DEV OTP] {devOtp}</span>
            </div>
          )}

          {message && (
            <div className="p-3 border border-red-500/50 bg-red-950/30 text-red-300 font-mono text-xs leading-relaxed space-y-1 rounded-none">
              <div className="flex items-center gap-1.5 text-red-400 font-bold tracking-wider uppercase text-[0.6875rem]">
                <ShieldAlert className="size-3.5 text-red-400 shrink-0" />
                <span>[ AUTHENTICATION ERROR ]</span>
              </div>
              <p className="text-[0.6875rem] text-red-200 leading-relaxed">{message}</p>
            </div>
          )}

          <Button
            className="w-full font-mono text-xs uppercase tracking-wider h-11 font-semibold rounded-none bg-lime-400 text-black font-bold hover:bg-lime-400 cursor-pointer disabled:opacity-50 transition-colors"
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
            className="flex items-center justify-center gap-1.5 w-full text-center font-mono text-[0.625rem] tracking-[0.16em] text-zinc-400 uppercase transition-colors hover:text-lime-400 cursor-pointer pt-1"
          >
            <ArrowLeft className="size-3" /> Use another email address
          </button>
        </form>
      )}

      {step === "onboarding" && (
        <form
          className="auth-form space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300 ease-out"
          onSubmit={handleOnboardingSubmit}
        >
          <div>
            <Label
              htmlFor="ob-name"
              className="font-mono text-[0.6875rem] uppercase tracking-wider text-zinc-400 block mb-1.5"
            >
              Full name
            </Label>
            <Input
              id="ob-name"
              value={name}
              onChange={(e) => {
                dispatch(setName(e.target.value));
                if (message) dispatch(setMessage(null));
              }}
              placeholder="Ada Lovelace"
              required
              autoFocus
              className="font-mono text-sm h-10 rounded-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label
                htmlFor="ob-handle"
                className="font-mono text-[0.6875rem] uppercase tracking-wider text-zinc-400"
              >
                Member handle / alias
              </Label>
              <div className="flex items-center h-4">
                {handleStatus === "checking" && (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] text-lime-400/90 font-mono transition-opacity animate-pulse">
                    <Loader2 className="spin size-3" /> checking...
                  </span>
                )}
                {handleStatus === "available" && (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] text-emerald-400 font-mono font-medium transition-all">
                    <Check size={12} className="text-emerald-400" /> handle available
                  </span>
                )}
                {handleStatus === "taken" && (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] text-rose-400 font-mono font-medium transition-all">
                    <X size={12} className="text-rose-400" /> handle taken
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500">
                @
              </span>
              <Input
                id="ob-handle"
                value={handle}
                onChange={(e) => {
                  dispatch(setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")));
                  if (message) dispatch(setMessage(null));
                }}
                placeholder="adalovelace"
                required
                className={cn(
                  "font-mono text-sm pl-8 h-10 rounded-none",
                  handleStatus === "available" && "border-emerald-500/70 focus-visible:ring-emerald-500 text-emerald-200",
                  handleStatus === "taken" && "border-rose-500/70 focus-visible:ring-rose-500 text-rose-200",
                )}
              />
            </div>
            <p className="mt-1.5 font-mono text-[0.6875rem] text-zinc-500">
              Letters, numbers, and underscores only. This will be your permanent campus alias.
            </p>
          </div>

          {message && (
            <div className="p-3 border border-red-500/50 bg-red-950/30 text-red-300 font-mono text-xs leading-relaxed space-y-1 rounded-none">
              <div className="flex items-center gap-1.5 text-red-400 font-bold tracking-wider uppercase text-[0.6875rem]">
                <ShieldAlert className="size-3.5 text-red-400 shrink-0" />
                <span>[ REGISTRATION ERROR ]</span>
              </div>
              <p className="text-[0.6875rem] text-red-200 leading-relaxed">{message}</p>
            </div>
          )}

          <Button
            className="w-full font-mono text-xs uppercase tracking-wider h-11 font-semibold rounded-none bg-lime-400 text-black font-bold hover:bg-lime-400 cursor-pointer disabled:opacity-50 transition-colors"
            disabled={
              pending ||
              !name.trim() ||
              handle.trim().length < 3 ||
              handleStatus === "taken" ||
              handleStatus === "checking"
            }
            type="submit"
          >
            {pending ? <Loader2 className="spin size-4" /> : "Complete Registration →"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
