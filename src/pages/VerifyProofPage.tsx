import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setVerifyTerm, setVerifySubmitted } from "@/store/slices/portalSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { VerifyProofSkeleton } from "@/organization/components/skeletons";
import { useSwrData } from "@/lib/cache/swrCache";

export function VerifyProofPage() {
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const term = useAppSelector((s) => s.portal.verifyTerm);
  const submitted = useAppSelector((s) => s.portal.verifySubmitted);

  const { data: publicData, loading } = useSwrData(
    "public:portal:data",
    () => getPublicPortalData(),
    { ttl: 5 * 60 * 1000 }
  );
  const proofs = publicData?.proofs || [];

  useEffect(() => {
    const proofQuery = searchParams.get("proof");
    if (proofQuery) {
      dispatch(setVerifyTerm(proofQuery));
      dispatch(setVerifySubmitted(proofQuery));
    }
  }, [searchParams, dispatch]);

  const result = submitted
    ? proofs.find(
        (p) =>
          p.certificate_id?.toLowerCase() === submitted.toLowerCase() ||
          p.sha256_digest?.toLowerCase() === submitted.toLowerCase()
      )
    : undefined;

  if (loading && !publicData) {
    return <VerifyProofSkeleton />;
  }

  return (
    <div className="page-wrap verify-wrap p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex size-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-semibold">
              Chaos Computer Club · Medi-Caps Chapter
            </p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-mono font-bold text-white uppercase tracking-tight">
            Certificate & Proof Verification
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Public SHA-256 Cryptographic Credential & Contest Achievement Verification Console.
          </p>
        </div>
        <ShieldCheck className="w-10 h-10 text-[var(--accent)] opacity-80" />
      </header>

      {/* ── SEARCH CARD ── */}
      <Card className="rounded-none border border-[#262626] bg-[#0d0d0d]">
        <CardContent className="p-6 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              dispatch(setVerifySubmitted(term));
            }}
            className="space-y-3"
          >
            <label htmlFor="verifyTerm" className="block font-mono text-xs uppercase tracking-wider text-neutral-300 font-bold">
              Enter Certificate ID or SHA-256 Digest
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 size-4 text-neutral-500" />
                <Input
                  id="verifyTerm"
                  type="text"
                  placeholder="e.g. CCC-MCU-2026-001 or e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                  value={term}
                  onChange={(e) => dispatch(setVerifyTerm(e.target.value))}
                  className="font-mono text-sm bg-black border-[#333] pl-10 h-11 rounded-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                />
              </div>
              <Button
                type="submit"
                className="h-11 px-6 rounded-none bg-[var(--accent)] text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-[var(--accent)]/90"
              >
                Verify Proof
              </Button>
            </div>
          </form>

          {/* Result Card */}
          {submitted && (
            <div className="pt-2">
              {result ? (
                <div className="border border-emerald-500/40 bg-emerald-950/20 p-6 space-y-4 font-mono">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                      <div>
                        <h3 className="text-base font-black text-white uppercase">Valid Cryptographic Credential</h3>
                        <p className="text-[11px] text-emerald-400">Authenticity Verified on Medi-Caps Ledger</p>
                      </div>
                    </div>
                    <Badge className="rounded-none bg-emerald-500 text-black text-xs font-bold uppercase">
                      VERIFIED
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="border border-[var(--line)] bg-black/40 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Recipient</p>
                      <p className="font-bold text-white mt-0.5">{result.recipient_name || "Cadet"}</p>
                    </div>
                    <div className="border border-[var(--line)] bg-black/40 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Certificate ID</p>
                      <p className="font-bold text-[var(--accent)] mt-0.5">{result.certificate_id}</p>
                    </div>
                    <div className="border border-[var(--line)] bg-black/40 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Title / Achievement</p>
                      <p className="font-bold text-white mt-0.5">{result.title}</p>
                    </div>
                    <div className="border border-[var(--line)] bg-black/40 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Issued Date</p>
                      <p className="font-bold text-white mt-0.5">{result.issued_at}</p>
                    </div>
                    <div className="border border-[var(--line)] bg-black/40 p-3 md:col-span-2">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">SHA-256 Digest</p>
                      <p className="text-[11px] text-emerald-300 font-mono mt-0.5 break-all">{result.sha256_digest}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-red-500/40 bg-red-950/20 p-6 space-y-2 font-mono">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="size-5 text-red-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white uppercase">No Verification Record Found</h3>
                  </div>
                  <p className="text-xs text-red-300">
                    The certificate ID or hash <code className="text-white bg-black/50 px-1 py-0.5">{submitted}</code> is not registered on the Medi-Caps Chapter public ledger.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
