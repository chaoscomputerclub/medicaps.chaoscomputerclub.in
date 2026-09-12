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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recover")({
  head: () => ({
    meta: [{ title: "Account Recovery — CCC Member Portal" }],
  }),
  component: RecoverPage,
});

function RecoverPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setTimeout(() => {
      setPending(false);
      setSuccess(true);
    }, 500);
  };

  return (
    <AuthLayout
      title="Identity Recovery"
      description="Use your emergency recovery seed or campus identity to restore access to your CCC credential."
      footer={
        <div className="flex items-center justify-between text-xs">
          <Link to="/login" className="text-muted-foreground hover:text-accent">
            Back to sign in
          </Link>
          <Link to="/signup" className="text-muted-foreground hover:text-accent">
            Register new identity
          </Link>
        </div>
      }
    >
      {success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">
            A temporary recovery credential has been routed to your campus inbox.
          </p>
          <Button
            onClick={() => navigate({ to: "/login" })}
            className="w-full rounded-none font-mono uppercase text-xs"
          >
            Return to Sign In
          </Button>
        </div>
      ) : (
        <form onSubmit={handleRecover} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-[0.5625rem] tracking-[0.16em] uppercase text-muted-foreground">
              Registered Email
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
          <div className="space-y-2">
            <Label htmlFor="key" className="font-mono text-[0.5625rem] tracking-[0.16em] uppercase text-muted-foreground">
              Recovery Key (Optional)
            </Label>
            <Input
              id="key"
              type="text"
              placeholder="12-word seed or recovery token"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              className="rounded-none font-mono text-sm"
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full rounded-none font-mono uppercase text-xs">
            {pending ? "Authenticating..." : "Dispatch Recovery Link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
