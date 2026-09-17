import { useState, useRef, useEffect } from "react";
import { QrCode, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, UserCheck, MapPin, Search, ArrowRight, Zap, RefreshCw } from "lucide-react";
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Interactive Scanner Terminal */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-red-400" />
                <CardTitle className="font-mono text-sm tracking-wide uppercase text-white font-bold">
                  Faculty Proctor QR Pass Scanner
                </CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] uppercase bg-zinc-900 border-zinc-700 text-zinc-300">
                Air-Gapped Gate Guard
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-1">
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
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-2">
                  Scan QR String or Enter Pass Code:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      type="text"
                      value={passInput}
                      onChange={(e) => setPassInput(e.target.value)}
                      placeholder="e.g. CCC-PASS:CCC-WEEKLY-1-EN23-01 or CCC-WEEKLY-1-EN23-01"
                      disabled={isVerifying}
                      className="font-mono text-sm bg-black border-zinc-700 text-white placeholder:text-zinc-600 focus:border-red-500 rounded-none h-11 pr-10"
                    />
                    <div className="absolute right-3 top-3 text-zinc-500 font-mono text-xs">
                      [ENTER]
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isVerifying || !passInput.trim()}
                    className="bg-red-600 hover:bg-red-500 text-white font-mono text-xs uppercase px-6 h-11 rounded-none font-bold"
                  >
                    {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Zap className="w-4 h-4 mr-1.5" />}
                    Verify Pass
                  </Button>
                </div>
              </div>

              {/* Quick sample pass triggers for testing */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                <span className="text-zinc-500">Quick Test Samples:</span>
                {["CCC-WEEKLY-1-EN23-01", "CCC-WEEKLY-1-EN23-02", "CCC-WEEKLY-1-EN23-03"].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setPassInput(code);
                      handleVerify(code);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 text-[11px]"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </form>

            {/* Verification Result Card */}
            {lastResult && (
              <div
                className={`p-5 rounded-sm border ${
                  lastResult.valid
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : "bg-red-950/20 border-red-500/40 text-red-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {lastResult.valid ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold uppercase tracking-wider">
                          {lastResult.valid
                            ? lastResult.status === "already_checked_in"
                              ? "ALREADY CHECKED IN"
                              : "ACCESS GRANTED — CHECKED IN"
                            : "ACCESS DENIED / INVALID PASS"}
                        </span>
                        {lastResult.valid && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                            ADMITTED
                          </Badge>
                        )}
                      </div>

                      {lastResult.valid ? (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                          <div className="bg-black/40 p-2.5 rounded border border-emerald-500/20">
                            <span className="text-zinc-500 block text-[10px] uppercase">Candidate</span>
                            <span className="text-white font-bold">{lastResult.candidate_name || lastResult.handle}</span>
                            <span className="text-emerald-400 block text-[11px]">@{lastResult.handle}</span>
                          </div>
                          <div className="bg-black/40 p-2.5 rounded border border-emerald-500/20">
                            <span className="text-zinc-500 block text-[10px] uppercase">Assigned Workstation</span>
                            <span className="text-emerald-300 font-bold text-sm">{lastResult.seat_number}</span>
                            <span className="text-zinc-400 block text-[10px]">Air-Gapped Lab 04</span>
                          </div>
                          <div className="bg-black/40 p-2.5 rounded border border-emerald-500/20">
                            <span className="text-zinc-500 block text-[10px] uppercase">Pass Code</span>
                            <span className="text-white font-bold">{lastResult.pass_code}</span>
                            <span className="text-zinc-500 block text-[10px]">Verified by {lastResult.checked_in_by}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="font-mono text-xs text-red-400 mt-2">
                          {lastResult.reason || "The scanned QR code or pass code could not be verified."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Live Gate Activity Feed */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <CardTitle className="font-mono text-xs tracking-wide uppercase text-white font-bold">
                  Recent Gate Admissions ({recentScans.length})
                </CardTitle>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Live SSE Feed</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 max-h-[420px] overflow-y-auto space-y-2">
            {recentScans.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-zinc-600">
                Awaiting first gate check-in...
              </div>
            ) : (
              recentScans.map((scan, idx) => (
                <div
                  key={scan.pass_code || idx}
                  className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-sm flex items-center justify-between gap-3 text-xs font-mono"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{scan.candidate_name || scan.handle}</span>
                      <span className="text-zinc-500 text-[11px]">(@{scan.handle})</span>
                    </div>
                    <div className="text-zinc-400 text-[11px] flex items-center gap-2 mt-0.5">
                      <span className="text-emerald-400 font-bold">{scan.seat_number}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-500">{scan.pass_code}</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                    ADMITTED
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
