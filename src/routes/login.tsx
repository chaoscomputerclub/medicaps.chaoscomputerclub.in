/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/organization/components/AuthLayout";
import { OtpStep } from "@/organization/components/OtpStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign In — CCC Member Portal" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid university email address.");
      return;
    }
    setError(null);
    setPending(true);
    setTimeout(() => {
      setPending(false);
      setStep("otp");
    }, 400);
  };

  const handleVerify = (_code: string) => {
    setPending(true);
    setTimeout(() => {
      setPending(false);
      navigate({ to: "/portal" });
    }, 400);
  };

  return (
    <AuthLayout
      title="Sign in to your member account"
      description="Enter your registered campus email. We will send a six-digit authentication code."
      footer={
        <div className="flex items-center justify-between text-xs">
          <Link to="/signup" className="text-muted-foreground hover:text-accent transition-colors">
            New member? Register
          </Link>
          <Link to="/recover" className="text-muted-foreground hover:text-accent transition-colors">
            Account recovery
          </Link>
        </div>
      }
    >
      {step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-[0.5625rem] tracking-[0.16em] uppercase text-muted-foreground">
              Campus / Student Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="handle@medicaps.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="rounded-none font-mono text-sm"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full rounded-none font-mono uppercase text-xs">
            {pending ? "Sending code..." : "Send Authentication Code"}
          </Button>
        </form>
      ) : (
        <OtpStep
          email={email}
          pending={pending}
          error={error}
          onVerify={handleVerify}
          onResend={() => {}}
          onChangeEmail={() => setStep("email")}
        />
      )}
    </AuthLayout>
  );
}
