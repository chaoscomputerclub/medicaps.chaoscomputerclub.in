import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Copy,
  Check,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Lock,
  FileCheck2,
  Hash,
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
import { toast } from "sonner";

export function VerifyProofPage() {
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const term = useAppSelector((s) => s.portal.verifyTerm);
  const submitted = useAppSelector((s) => s.portal.verifySubmitted);
  const [copiedHash, setCopiedHash] = useState(false);

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

  const copyDigest = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    toast.success("SHA-256 Digest copied to clipboard");
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (loading && !publicData) {
    return <VerifyProofSkeleton />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        kicker="07 // Cryptographic Trust"
        index="INDEX 7.0 · PROOF VERIFICATION"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
            SHA-256 Verified Credentials
          </span>
        }
        title="Proof Verification"
        description="Public SHA-256 Cryptographic Credential & Contest Achievement Verification Console."
        action={
          <div className="size-11 rounded-lg bg-black border border-white/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-6 text-lime-400" />
          </div>
        }
      />

      {/* ── SEARCH CARD ── */}
      <div className="rounded-lg border border-white/8 bg-black p-6 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (term.trim()) {
              dispatch(setVerifySubmitted(term.trim()));
            }
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
                className="font-mono text-xs bg-black border-white/10 pl-10 h-11 rounded-md text-white placeholder:text-zinc-500 focus-visible:border-lime-400 focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              className="h-11 px-6 rounded-md bg-transparent text-lime-400 border border-lime-400 font-semibold text-xs uppercase tracking-wider hover:bg-lime-400 hover:text-black active:scale-[0.98] cursor-pointer transition-colors"
            >
              Verify Proof
            </Button>
          </div>
        </form>

        {/* Quick sample chips */}
        {proofs.length > 0 && !submitted && (
          <div className="pt-2 border-t border-white/5 space-y-2">
            <p className="text-[11px] font-mono text-zinc-500">Sample active certificates to verify:</p>
            <div className="flex flex-wrap gap-2">
              {proofs.slice(0, 3).map((p) => (
                <button
                  key={p.certificate_id}
                  type="button"
                  onClick={() => {
                    dispatch(setVerifyTerm(p.certificate_id));
                    dispatch(setVerifySubmitted(p.certificate_id));
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-[11px] font-mono text-zinc-300 hover:border-lime-400/50 hover:text-white transition-colors cursor-pointer"
                >
                  <FileCheck2 className="size-3 text-lime-400" />
                  {p.certificate_id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result Container */}
        {submitted && (
          <div className="pt-2">
            {result ? (
              <div className="rounded-lg border border-emerald-500/30 bg-black p-6 space-y-5 font-mono">
                <div className="flex items-center justify-between border-b border-white/8 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-md bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Valid Cryptographic Credential</h3>
                      <p className="text-[11px] text-emerald-400 mt-0.5">Authenticity Verified on Medi-Caps Node Ledger</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-emerald-500/40 bg-emerald-950/20 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 rounded">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Recipient</p>
                    <p className="font-semibold text-white">{result.recipient_name || "Cadet"}</p>
                  </div>
                  <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Certificate ID</p>
                    <p className="font-semibold text-lime-400">{result.certificate_id}</p>
                  </div>
                  <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Title / Achievement</p>
                    <p className="font-semibold text-white">{result.title}</p>
                  </div>
                  <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Issued Date</p>
                    <p className="font-semibold text-white tabular-nums">{result.issued_at}</p>
                  </div>
                  <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-1 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-1">
                        <Hash className="size-3 text-lime-400" /> SHA-256 Digest
                      </p>
                      <button
                        type="button"
                        onClick={() => copyDigest(result.sha256_digest)}
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedHash ? (
                          <>
                            <Check className="size-3 text-lime-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" /> Copy Hash
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-emerald-300 font-mono mt-1 break-all bg-white/5 p-2 rounded border border-white/5">
                      {result.sha256_digest}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>Standard: RFC-6234 SHA-256</span>
                  <span>Node: MCU-CCC-PROD-01</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-rose-500/30 bg-black p-6 space-y-3 font-mono">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-md bg-rose-950/40 border border-rose-500/40 flex items-center justify-center shrink-0">
                    <ShieldAlert className="size-5 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Verification Record Found</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">The provided query could not be matched against any issued credential</p>
                  </div>
                </div>
                <p className="text-xs text-rose-300/90 leading-relaxed">
                  The certificate ID or digest <code className="text-white bg-white/10 px-1.5 py-0.5 rounded font-mono">{submitted}</code> is not registered on the Medi-Caps Chapter public ledger.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
