import { useState, useRef, useEffect } from "react";
import { QrCode, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, UserCheck, MapPin, Search, ArrowRight, Zap, RefreshCw, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { triggerWebhookGateScan } from "@/lib/realtime";

interface GateScannerPanelProps {
  selectedContestSlug: string;
  proctorName: string;
  onPassCheckedIn?: (result: any) => void;
  recentScans: any[];
}

export function GateScannerPanel({
  selectedContestSlug,
  proctorName,
  onPassCheckedIn,
  recentScans,
}: GateScannerPanelProps) {
  const [passInput, setPassInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input for barcode scanner guns and fast keyboard entry
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async (codeToVerify?: string) => {
    const raw = (codeToVerify || passInput).trim();
    if (!raw) {
      toast.error("Please enter or scan a pass code or QR string.");
      inputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    try {
      // Direct webhook / verification call
      const res = await triggerWebhookGateScan(raw, proctorName, selectedContestSlug);
      setLastResult(res);

      if (res.valid) {
        toast.success(`ADMITTED: ${res.candidate_name || res.handle} (${res.seat_number})`);
        if (onPassCheckedIn) {
          onPassCheckedIn(res);
        }
      } else {
        toast.error(`VERIFICATION FAILED: ${res.reason || "Invalid pass"}`);
      }

      setPassInput("");
    } catch (err: any) {
      toast.error(err.message || "Failed to verify pass.");
      setLastResult({
        valid: false,
        reason: err.message || "Server error during pass verification.",
      });
    } finally {
      setIsVerifying(false);
      inputRef.current?.focus();
    }
  };

  const handleSimulatePass = (code: string) => {
    setPassInput(code);
    handleVerify(code);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Interactive Scanner Terminal */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="bg-zinc-950 border-white/10 rounded-none shadow-xl">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                  <QrCode className="w-4 h-4" />
                </div>
                <CardTitle className="font-mono text-sm tracking-wide uppercase text-white font-extrabold">
                  Air-Gapped Gate Pass Scanner
                </CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] uppercase bg-zinc-900 border-white/10 text-lime-400 font-bold px-2 py-0.5 rounded-none tracking-wider">
                PHYSICAL TURNSTILE 01
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-1 leading-relaxed">
              Accepts laser barcode scanner inputs, web camera QR payloads, or manual candidate pass codes.
            </p>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="gate-pass-input" className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5 tracking-wider">
                  Scan QR / Enter Pass Code:
                </label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="gate-pass-input"
                    type="text"
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Scan pass code (e.g. CCC-PASS-XXXXXX or payload)"
                    className="bg-black border-white/20 text-base sm:text-sm font-mono text-white placeholder:text-zinc-600 rounded-none h-12 pr-12 focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:border-lime-400"
                    disabled={isVerifying}
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-3.5 text-zinc-500 flex items-center gap-1">
                    <QrCode className="w-5 h-5 text-lime-400/70" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={isVerifying}
                  className="flex-1 bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-extrabold tracking-wider h-11 rounded-none shadow-lg shadow-lime-400/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                      Cryptographically Verifying…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-1.5" />
                      Authorize Physical Check-In
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPassInput("");
                    setLastResult(null);
                    inputRef.current?.focus();
                  }}
                  className="h-11 border-white/10 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white font-mono text-xs uppercase rounded-none cursor-pointer"
                >
                  Clear
                </Button>
              </div>
            </form>

            {/* Quick Test Barcodes for Simulation */}
            <div className="p-3 bg-black border border-white/10 space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Quick Check-In Simulation (Proctor Testing):
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {["CCC-PASS-TOP30-01", "CCC-PASS-TOP30-02", "CCC-PASS-INVALID"].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => handleSimulatePass(sample)}
                    className="text-[10px] font-mono text-zinc-400 hover:text-lime-400 border border-white/10 hover:border-lime-400/40 px-2 py-1 rounded-none bg-zinc-950 cursor-pointer transition-colors"
                  >
                    Simulate {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Verification Result Banner */}
            {lastResult && (
              <div
                className={`p-4 border rounded-none transition-all animate-in fade-in duration-150 ${
                  lastResult.valid
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  {lastResult.valid ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-mono text-sm font-bold tracking-wide uppercase">
                        {lastResult.valid ? "Admittance Authorized (Gate Open)" : "Admittance Rejected"}
                      </h4>
                      {lastResult.seat_number && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-black">
                          {lastResult.seat_number}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono">
                      {lastResult.valid
                        ? `Candidate: ${lastResult.candidate_name || lastResult.handle || "Cadet"} (@${lastResult.handle || "cadet"})`
                        : lastResult.reason || "Invalid pass credentials."}
                    </p>

                    {lastResult.valid && (
                      <div className="pt-2 flex items-center gap-4 text-[11px] text-zinc-400 font-mono">
                        <span>Workstation: <strong className="text-white">{lastResult.seat_number || "Lab 04"}</strong></span>
                        <span>Contest: <strong className="text-white">{lastResult.contest_slug || selectedContestSlug}</strong></span>
                        <span>Pass: <strong className="text-white">{lastResult.pass_code}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Live Stream of Recent Admittances */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="bg-zinc-950 border-white/10 rounded-none shadow-xl">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-lime-400" />
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-white font-extrabold">
                  Live Gate Event Feed
                </CardTitle>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                {recentScans.length} events logged
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {recentScans.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 space-y-2">
                <QrCode className="w-8 h-8 mx-auto text-zinc-700" />
                <p className="text-xs font-mono">No scans recorded yet this session.</p>
                <p className="text-[10px] text-zinc-600">
                  Scan cadet passes via the terminal on the left to stream events here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {recentScans.map((scan, idx) => (
                  <div
                    key={scan.pass_code || scan.id || idx}
                    className="p-3 bg-black border border-white/10 rounded-none flex items-center justify-between gap-3 text-xs font-mono hover:border-lime-400/30 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate">
                          {scan.candidate_name || scan.handle || "Cadet"}
                        </span>
                        <span className="text-[10px] text-zinc-500">@{scan.handle || "cadet"}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                        <span>Pass: {scan.pass_code}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {scan.checked_in_at
                            ? new Date(scan.checked_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                            : "Just now"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 bg-lime-400/10 text-lime-400 border border-lime-400/30 text-[10px] font-mono font-bold">
                        {scan.seat_number || "WS-ASSIGNED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
