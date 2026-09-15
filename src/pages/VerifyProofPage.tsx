import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setVerifyTerm, setVerifySubmitted } from "@/store/slices/portalSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { contestApi } from "@/features/contest/api";
import { VerifyProofSkeleton } from "@/organization/components/skeletons";

export function VerifyProofPage() {
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const term = useAppSelector((s) => s.portal.verifyTerm);
  const submitted = useAppSelector((s) => s.portal.verifySubmitted);

  const [activeTab, setActiveTab] = useState<"gate_scanner" | "cert_proof">("gate_scanner");
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Proctor QR Scanner States
  const [qrInput, setQrInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

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
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const proofQuery = searchParams.get("proof");
    const passQuery = searchParams.get("pass");
    if (proofQuery) {
      setActiveTab("cert_proof");
      dispatch(setVerifyTerm(proofQuery));
      dispatch(setVerifySubmitted(proofQuery));
    } else if (passQuery) {
      setActiveTab("gate_scanner");
      setQrInput(passQuery);
      handleVerifyGatePass(passQuery);
    }
  }, [searchParams, dispatch]);

  const handleVerifyGatePass = async (codeToVerify?: string) => {
    const target = (codeToVerify || qrInput).trim();
    if (!target) {
      toast.error("Please enter or scan a valid student QR pass code.");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await contestApi.verifyProctorPass({ pass_code_or_qr: target });
      setScanResult(res);
      if (res.valid) {
        if (res.status === "already_checked_in") {
          toast.info("Candidate already checked in.");
        } else {
          toast.success(`Verified! Seat ${res.seat_number} allocated to ${res.candidate_name}`);
        }
      } else {
        toast.error(res.message || "Invalid pass presented.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify gate pass");
      setScanResult({
        valid: false,
        status: "error",
        message: err.message || "Verification service unreachable.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const result = submitted
    ? proofs.find(
        (p) =>
          p.certificate_id?.toLowerCase() === submitted.toLowerCase() ||
          p.sha256_digest?.toLowerCase() === submitted.toLowerCase()
      )
    : undefined;

  if (loading) {
    return <VerifyProofSkeleton />;
  }

  return (
    <div className="page-wrap verify-wrap p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex size-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-semibold">
              Chaos Computer Club · Medi-Caps Chapter
            </p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-mono font-bold text-white uppercase tracking-tight">
            Security & Trust Gate
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Faculty Proctor QR Pass Scanner for Air-Gapped Lab Entry & Public Cryptographic Verification Console.
          </p>
        </div>
        <ShieldCheck className="w-10 h-10 text-[var(--accent)] opacity-80" />
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="bg-[#141414] border border-[#262626] p-1 rounded-none grid grid-cols-2 max-w-md">
          <TabsTrigger
            value="gate_scanner"
            className="rounded-none font-mono text-xs uppercase data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black font-bold tracking-wider"
          >
            <QrCode className="size-3.5 mr-2" />
            Proctor Gate Scanner
          </TabsTrigger>
          <TabsTrigger
            value="cert_proof"
            className="rounded-none font-mono text-xs uppercase data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black font-bold tracking-wider"
          >
            <ShieldCheck className="size-3.5 mr-2" />
            Certificate Proofs
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: FACULTY / PROCTOR GATE SCANNER ─── */}
        <TabsContent value="gate_scanner" className="space-y-6">
          <Card className="rounded-none border border-[#262626] bg-[#0d0d0d]">
            <CardHeader className="border-b border-[#1f1f1f] pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-none border border-[var(--accent)]/40 bg-[var(--accent)]/10 grid place-items-center text-[var(--accent)]">
                    <UserCheck className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="font-mono text-base font-bold uppercase tracking-wider text-white">
                      Lab Entry QR Scanner
                    </CardTitle>
                    <p className="font-mono text-xs text-neutral-400">
                      Chief Proctors: Dr. Ratnesh Litoriya, Prof. Amit Shrivastava
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-none border-emerald-500/40 text-emerald-400 font-mono text-[10px] uppercase">
                  Air-Gapped Gate Proctored
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyGatePass();
                }}
                className="space-y-3"
              >
                <label htmlFor="qrInput" className="block font-mono text-xs uppercase tracking-wider text-neutral-300">
                  Scan QR Code or Enter Candidate Pass Code
                </label>
                <div className="flex gap-3">
                  <Input
                    id="qrInput"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="e.g. CCC-PASS:CCC-WEEKLY-42-SANT-01:uuid:LAB-04-PC01:QUALIFIED"
                    className="font-mono text-sm bg-black border-[#292929] text-white rounded-none focus-visible:ring-[var(--accent)] placeholder:text-neutral-600"
                  />
                  <Button
                    type="submit"
                    disabled={isVerifying}
                    className="bg-[var(--accent)] text-black hover:bg-[#b8f025] font-mono font-bold text-xs uppercase rounded-none shrink-0 tracking-wider px-6"
                  >
                    <Search className="size-3.5 mr-2" />
                    {isVerifying ? "Verifying…" : "Verify Pass"}
                  </Button>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] text-neutral-500">
                  <span>Accepts raw camera QR strings or manual pass codes</span>
                  <span className="text-neutral-400">Press Enter or click Verify</span>
                </div>
              </form>

              {/* Verified Result Card */}
              {scanResult && (
                <div className="pt-2">
                  {scanResult.valid ? (
                    <div className="border border-emerald-500/50 bg-emerald-950/20 p-6 space-y-4 rounded-none">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-500/30 pb-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="size-6 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                              {scanResult.status === "already_checked_in" ? "ALREADY CHECKED IN" : "GATE PASS VERIFIED · ACCESS GRANTED"}
                            </span>
                            <h2 className="text-xl font-bold uppercase tracking-tight text-white font-mono mt-0.5">
                              {scanResult.candidate_name} (@{scanResult.handle})
                            </h2>
                            <p className="font-mono text-xs text-neutral-300">
                              {scanResult.department} · Batch {scanResult.batch}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="font-mono text-[10px] text-neutral-400 uppercase">Assigned Workstation</span>
                          <div className="font-mono text-xl font-black text-emerald-400 bg-black/60 px-3 py-1 border border-emerald-500/40">
                            {scanResult.seat_number}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                        <div>
                          <span className="text-neutral-500 text-[10px] uppercase block">Contest</span>
                          <strong className="text-white">{scanResult.contest_title || "Weekly Contest"}</strong>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] uppercase block">Round 1 Rank</span>
                          <strong className="text-[var(--accent)]">Rank #{scanResult.qualification_rank || 1}</strong>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] uppercase block">Screening Score</span>
                          <strong className="text-white">{scanResult.screening_score ?? 100} pts</strong>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[10px] uppercase block">Verified By</span>
                          <strong className="text-neutral-200">{scanResult.checked_in_by || "Dr. Ratnesh Litoriya"}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-rose-500/50 bg-rose-950/20 p-6 flex items-start gap-4 rounded-none">
                      <ShieldAlert className="size-6 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-rose-400 font-bold block">
                          VERIFICATION REJECTED
                        </span>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-white font-mono mt-0.5">
                          {scanResult.message}
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1 font-mono">
                          Only verified Top 30 qualifiers with an authentic signature are authorized to enter the lab.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: CERTIFICATE PROOF CONSOLE ─── */}
        <TabsContent value="cert_proof" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
