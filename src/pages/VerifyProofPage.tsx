import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setVerifyTerm, setVerifySubmitted } from "@/store/slices/portalSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { getPublicPortalData } from "@/organization/data/portal.functions";

export function VerifyProofPage() {
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const term = useAppSelector((s) => s.portal.verifyTerm);
  const submitted = useAppSelector((s) => s.portal.verifySubmitted);

  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPublicPortalData()
      .then((res) => {
        if (active) {
          setProofs(res.proofs || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load verification proofs:", err);
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

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

  return (
    <div className="page-wrap verify-wrap p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-semibold mb-1">
            Public trust console
          </p>
          <h1 className="text-3xl sm:text-4xl font-mono font-bold text-white uppercase tracking-tight">
            Verify a result
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Check a certificate ID or complete SHA-256 digest against the sealed campus record.
          </p>
        </div>
        <ShieldCheck className="w-10 h-10 text-[var(--accent)] opacity-80" />
      </header>

      <form
        className="space-y-3 border border-[#292929] bg-[#0d0d0d] p-6"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch(setVerifySubmitted(term.trim()));
        }}
      >
        <label htmlFor="proof" className="block font-mono text-xs uppercase tracking-wider text-neutral-400">
          Certificate ID / SHA-256 digest
        </label>
        <div className="flex gap-3">
          <Input
            id="proof"
            value={term}
            onChange={(e) => dispatch(setVerifyTerm(e.target.value))}
            placeholder="CCC-MED-..."
            className="font-mono text-sm bg-black border-[#292929] text-white rounded-none focus-visible:ring-[var(--accent)]"
          />
          <Button
            type="submit"
            className="bg-[var(--accent)] text-black hover:brightness-110 hover:text-black font-mono font-bold text-xs uppercase rounded-none shrink-0"
          >
            <Search className="w-3.5 h-3.5 mr-1.5" /> Verify
          </Button>
        </div>
        <small className="font-mono text-[10px] text-neutral-500 block">
          Enter an official certificate ID or complete SHA-256 digest.
        </small>
      </form>

      {!submitted && (
        <div className="border border-dashed border-[#292929] bg-neutral-900/20 p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-400">
            Awaiting Verification Query
          </h3>
          <p className="font-mono text-xs text-neutral-500 max-w-md mx-auto mt-2 leading-relaxed">
            Enter an official certificate ID or a 64-character SHA-256 digest above to validate authentic contest attendance, seat, and proctored records.
          </p>
        </div>
      )}

      {submitted &&
        (result ? (
          <div className="border border-emerald-500/40 bg-emerald-950/20 p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider block">
                  AUTHENTIC RECORD
                </span>
                <h2 className="font-mono text-lg font-bold text-white uppercase">
                  Proof chain validated
                </h2>
                <p className="text-xs text-neutral-300 mt-0.5">
                  The result matches the signed attendance, seat, proctor, and contest session record.
                </p>
              </div>
            </div>
            <ProofBadge proof={result} />
          </div>
        ) : (
          <div className="border border-rose-500/40 bg-rose-950/20 p-6 flex items-start gap-4 text-rose-400">
            <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider block">
                NO MATCH
              </span>
              <h2 className="font-mono text-lg font-bold text-white uppercase">
                Record could not be verified
              </h2>
              <p className="text-xs text-neutral-300 mt-0.5">
                Check the identifier exactly. An absent record is not proof of participation.
              </p>
            </div>
          </div>
        ))}
    </div>
  );
}
