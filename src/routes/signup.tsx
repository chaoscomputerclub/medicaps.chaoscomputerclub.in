import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/organization/components/AuthLayout";
import { OtpStep } from "@/organization/components/OtpStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Member Registration — CCC Member Portal" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = (e: React.FormEvent) => {
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
      title="Create your club identity"
      description="Join Medi-Caps University chapter of Chaos Computer Club. Access offline contests, workshops, and repository archives."
      footer={
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Already have an identity?</span>
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </div>
      }
    >
      {step === "details" ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-mono text-[0.5625rem] tracking-[0.16em] uppercase text-muted-foreground">
              Full Name
            </Label>
            <Input
              id="name"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="rounded-none font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle" className="font-mono text-[0.5625rem] tracking-[0.16em] uppercase text-muted-foreground">
              Member Handle / Alias
            </Label>
            <Input
              id="handle"
              placeholder="ada_core"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              className="rounded-none font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-[0.5625rem] tracking-[0.16em] uppercase text-muted-foreground">
              Campus Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="handle@medicaps.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-none font-mono text-sm"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full rounded-none font-mono uppercase text-xs">
            {pending ? "Initiating registration..." : "Verify & Issue Credential"}
          </Button>
        </form>
      ) : (
        <OtpStep
          email={email}
          pending={pending}
          error={error}
          onVerify={handleVerify}
          onResend={() => {}}
          onChangeEmail={() => setStep("details")}
        />
      )}
    </AuthLayout>
  );
}
