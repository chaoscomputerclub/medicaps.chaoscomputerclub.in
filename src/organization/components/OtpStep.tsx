/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/** Six-digit code step shared by sign-in, sign-up and recovery. */
export function OtpStep({
  email,
  pending,
  error,
  onVerify,
  onResend,
  onChangeEmail,
  submitLabel = "Verify and continue",
}: {
  email: string;
  pending: boolean;
  error: string | null;
  onVerify: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  submitLabel?: string;
}) {
  const [code, setCode] = useState("");

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onVerify(code);
      }}
    >
      <div className="space-y-2">
        <Label
          htmlFor="otp"
          className="font-mono text-[0.6875rem] tracking-wider text-zinc-400 uppercase"
        >
          Code sent to <span className="text-white font-medium">{email}</span>
        </Label>
        <InputOTP id="otp" maxLength={6} value={code} onChange={setCode} autoFocus>
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
        <p className="font-mono text-xs tabular-nums text-zinc-500">
          Six digits · expires in 10 minutes
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-rose-400 font-mono">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || code.length < 6}
        className="w-full rounded-md bg-transparent text-white border border-white/20 font-mono text-xs tracking-wider font-bold uppercase hover:bg-lime-400 hover:text-black hover:border-lime-400 h-11 transition-colors cursor-pointer disabled:opacity-50 [&_svg]:transition-colors"
      >
        {pending ? "Checking…" : submitLabel}
      </Button>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onResend}
          className="font-mono text-xs tracking-wider text-zinc-400 uppercase underline-offset-4 transition-colors duration-150 hover:text-lime-400 hover:underline cursor-pointer"
        >
          Resend code
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="font-mono text-xs tracking-wider text-zinc-400 uppercase underline-offset-4 transition-colors duration-150 hover:text-lime-400 hover:underline cursor-pointer"
        >
          Use another email
        </button>
      </div>
    </form>
  );
}
