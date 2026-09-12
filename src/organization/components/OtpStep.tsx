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
          className="font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
        >
          Code sent to {email}
        </Label>
        <InputOTP id="otp" maxLength={6} value={code} onChange={setCode} autoFocus>
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
        <p className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
          Six digits · expires in 10 minutes
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || code.length < 6}
        className="w-full rounded-none bg-accent font-mono text-[0.625rem] tracking-[0.16em] text-accent-foreground uppercase hover:bg-accent/90"
      >
        {pending ? "Checking…" : submitLabel}
      </Button>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onResend}
          className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline"
        >
          Resend code
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline"
        >
          Use another email
        </button>
      </div>
    </form>
  );
}
