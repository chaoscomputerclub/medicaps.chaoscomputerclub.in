/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Strix-inspired Minimalist Login Experience.
 * Strict Redux Toolkit global state management.
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { preloadFullProfile } from "@/organization/data/queries";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthLayout } from "@/organization/components/AuthLayout";
import { Label } from "@/components/ui/label";
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

function GitHubIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
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
  const [isSignUp, setIsSignUp] = useState(false);

  // Redux Toolkit state selectors
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
              ? `Access restricted: ${rejectedEmail} is not a Medi-Caps account. Only official @medicaps.ac.in emails are permitted.`
              : "Access restricted: Only official @medicaps.ac.in organization emails are permitted.",
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
          navigate("/");
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
            navigate("/");
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

  // Step 1: Send OTP via Redux Thunk
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
          "Only @medicaps.ac.in organization emails are permitted.",
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
        navigate("/");
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
    toast.success("Verification code resent to your inbox.");
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
      navigate("/");
    }
  }

  function handleGoogle() {
    window.location.href = getGoogleLoginURL();
  }

  function handleGitHub() {
    toast.info("GitHub SSO is reserved for CCC Campus Officers. Please continue with email or Google.");
  }

  // Configure layout header
  let title = isSignUp ? "Sign up" : "Sign in";
  let description: React.ReactNode = null;

  if (step === "otp") {
    title = "Enter verification code";
    description = (
      <span>
        We sent a 6-digit code to <strong className="text-white font-medium">{email}</strong>
      </span>
    );
  } else if (step === "onboarding") {
    title = "Complete your profile";
    description = "Choose your public name and campus alias to finish.";
  }

  return (
    <AuthLayout title={title} description={description}>
      {step === "email" && (
        <div>
          <form onSubmit={handleEmailSubmit}>
            <Label
              htmlFor="email"
              className="text-xs font-medium text-zinc-300 block mb-2"
            >
              Email
            </Label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                dispatch(setEmail(e.target.value));
                if (message) dispatch(setMessage(null));
              }}
              placeholder="Your email address"
              required
              autoFocus
              className={cn(
                "w-full h-11 px-3.5 bg-[#0e0e10] border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors",
                isInvalidDomain && "border-amber-500/70 focus:border-amber-500 focus:ring-amber-500",
              )}
            />

            {/* Validation & Error Messages */}
            {isInvalidDomain && (
              <p className="mt-2 text-xs text-amber-400 font-medium">
                Please use your official @medicaps.ac.in email address.
              </p>
            )}

            {message && !isInvalidDomain && (
              <p className="mt-2 text-xs text-red-400 font-medium leading-normal">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || isInvalidDomain}
              className="w-full h-11 mt-3.5 bg-white hover:bg-zinc-200 text-black font-medium text-sm rounded-lg transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin text-black" />
              ) : (
                "Continue with email"
              )}
            </button>
          </form>

          {/* OR Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-[#161618] px-2.5 text-zinc-500 font-medium select-none">
                OR
              </span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={pending}
              className="w-full h-11 px-4 bg-transparent hover:bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-lg text-sm font-medium text-zinc-200 transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <GoogleIcon className="size-4 shrink-0" />
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={handleGitHub}
              disabled={pending}
              className="w-full h-11 px-4 bg-transparent hover:bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-lg text-sm font-medium text-zinc-200 transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <GitHubIcon className="size-4 shrink-0 text-white" />
              <span>Continue with GitHub</span>
            </button>
          </div>

          {/* Bottom Prompt / Toggle */}
          <div className="mt-6 text-center text-xs sm:text-sm text-zinc-400">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    if (message) dispatch(setMessage(null));
                  }}
                  className="text-[#818cf8] hover:text-[#93c5fd] font-medium hover:underline cursor-pointer transition-colors"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    if (message) dispatch(setMessage(null));
                  }}
                  className="text-[#818cf8] hover:text-[#93c5fd] font-medium hover:underline cursor-pointer transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOtpSubmit}>
          <div className="text-center mb-5">
            <Label
              htmlFor="otp"
              className="text-xs font-medium text-zinc-400 block"
            >
              Verification code
            </Label>
            <div className="mt-4 flex justify-center">
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
                      className="size-11 sm:size-12 rounded-lg border border-white/10 bg-[#0e0e10] font-mono text-base tabular-nums focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-white text-center"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          {devOtp && (
            <div className="mb-4 text-center">
              <span className="inline-block px-2.5 py-1 rounded bg-zinc-800/80 border border-white/10 text-[11px] font-mono text-zinc-300">
                Dev Code: {devOtp}
              </span>
            </div>
          )}

          {message && (
            <p className="mb-4 text-center text-xs text-red-400 font-medium">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || otp.length < 6}
            className="w-full h-11 bg-white hover:bg-zinc-200 text-black font-medium text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin text-black" />
            ) : (
              "Verify and continue"
            )}
          </button>

          <div className="mt-5 flex items-center justify-between text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => {
                dispatch(setStep("email"));
                dispatch(setOtp(""));
                dispatch(setMessage(null));
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              ← Back to email
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={pending}
              className="text-[#818cf8] hover:text-[#93c5fd] hover:underline transition-colors cursor-pointer disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      {step === "onboarding" && (
        <form onSubmit={handleOnboardingSubmit} className="space-y-4">
          <div>
            <Label
              htmlFor="ob-name"
              className="text-xs font-medium text-zinc-300 block mb-2"
            >
              Full name
            </Label>
            <input
              id="ob-name"
              value={name}
              onChange={(e) => {
                dispatch(setName(e.target.value));
                if (message) dispatch(setMessage(null));
              }}
              placeholder="Ada Lovelace"
              required
              autoFocus
              className="w-full h-11 px-3.5 bg-[#0e0e10] border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label
                htmlFor="ob-handle"
                className="text-xs font-medium text-zinc-300"
              >
                Campus handle
              </Label>
              <div className="flex items-center h-4">
                {handleStatus === "checking" && (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                    <Loader2 className="size-3 animate-spin" /> checking…
                  </span>
                )}
                {handleStatus === "available" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <Check size={12} /> available
                  </span>
                )}
                {handleStatus === "taken" && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium">
                    <X size={12} /> taken
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500 select-none">
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
                  "w-full h-11 pl-8 pr-3.5 bg-[#0e0e10] border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors",
                  handleStatus === "available" && "border-emerald-500/60 focus:border-emerald-500",
                  handleStatus === "taken" && "border-red-500/60 focus:border-red-500",
                )}
              />
            </div>
          </div>

          {message && (
            <p className="text-xs text-red-400 font-medium">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={
              pending ||
              !name.trim() ||
              handle.trim().length < 3 ||
              handleStatus === "taken" ||
              handleStatus === "checking"
            }
            className="w-full h-11 mt-6 bg-white hover:bg-zinc-200 text-black font-medium text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin text-black" />
            ) : (
              "Enter CCC Arena"
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
