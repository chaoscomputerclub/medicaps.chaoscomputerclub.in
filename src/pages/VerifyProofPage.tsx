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
import { PageHeader } from "@/organization/components/ui";
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
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        kicker="07 // Cryptographic Trust"
        index="INDEX 7.0 · PROOF VERIFICATION"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-none border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
            SHA-256 Verified Credentials
          </span>
        }
        title="Proof Verification"
        description="Public SHA-256 Cryptographic Credential & Contest Achievement Verification Console."
        action={<ShieldCheck className="w-10 h-10 text-lime-400 opacity-90 shrink-0" />}
      />

      {/* ── SEARCH CARD ── */}
      <Card className="rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              dispatch(setVerifySubmitted(term));
            }}
            className="space-y-3"
          >
            <label htmlFor="verifyTerm" className="block font-mono text-xs uppercase tracking-wider text-zinc-300 font-bold">
              Enter Certificate ID or SHA-256 Digest
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                  id="verifyTerm"
                  type="text"
                  placeholder="e.g. CCC-MCU-2026-001 or e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                  value={term}
                  onChange={(e) => dispatch(setVerifyTerm(e.target.value))}
                  className="font-mono text-sm bg-zinc-950/60 border-white/10 pl-10 h-12 rounded-none text-white placeholder:text-zinc-500 focus-visible:border-lime-400/60"
                />
              </div>
              <Button
                type="submit"
                className="h-12 px-6 rounded-none bg-lime-400 text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-lime-400 shadow-lg shadow-lime-400/20 active:scale-[0.98]"
              >
                Verify Proof
              </Button>
            </div>
          </form>

          {/* Result Card */}
          {submitted && (
            <div className="pt-2">
              {result ? (
                <div className="rounded-none border border-emerald-500/40 bg-emerald-950/20 p-6 space-y-4 font-mono shadow-inner">
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
                    <div className="rounded-none border border-white/10 bg-zinc-950/50 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">Recipient</p>
                      <p className="font-bold text-white mt-0.5">{result.recipient_name || "Cadet"}</p>
                    </div>
                    <div className="rounded-none border border-white/10 bg-zinc-950/50 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">Certificate ID</p>
                      <p className="font-bold text-lime-400 mt-0.5">{result.certificate_id}</p>
                    </div>
                    <div className="rounded-none border border-white/10 bg-zinc-950/50 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">Title / Achievement</p>
                      <p className="font-bold text-white mt-0.5">{result.title}</p>
                    </div>
                    <div className="rounded-none border border-white/10 bg-zinc-950/50 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">Issued Date</p>
                      <p className="font-bold text-white mt-0.5 font-mono tabular-nums">{result.issued_at}</p>
                    </div>
                    <div className="rounded-none border border-white/10 bg-zinc-950/50 p-3 md:col-span-2">
                      <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">SHA-256 Digest</p>
                      <p className="text-[11px] text-emerald-300 font-mono mt-0.5 break-all">{result.sha256_digest}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-none border border-rose-500/40 bg-rose-950/20 p-6 space-y-2 font-mono shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="size-5 text-rose-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white uppercase">No Verification Record Found</h3>
                  </div>
                  <p className="text-xs text-rose-300">
                    The certificate ID or hash <code className="text-white bg-black/50 px-1.5 py-0.5 rounded font-mono">{submitted}</code> is not registered on the Medi-Caps Chapter public ledger.
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
