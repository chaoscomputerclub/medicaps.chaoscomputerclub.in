import { useState, useRef, useEffect, useCallback } from "react";
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  MapPin,
  Search,
  ArrowRight,
  Zap,
  RefreshCw,
  Camera,
  CameraOff,
  SwitchCamera,
  Upload,
  Keyboard,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { triggerWebhookGateScan } from "@/lib/realtime";

interface GateScannerPanelProps {
  selectedContestSlug: string;
  proctorName: string;
  onPassCheckedIn?: (result?: any) => void;
  recentScans: any[];
  attendees?: any[];
}

interface PendingCadetReview {
  raw: string;
  passCode: string;
  seatNumber: string;
  candidateName: string;
  handle: string;
  department: string;
  enrollmentNumber?: string;
  batch?: string;
  checkInStatus: string;
  checkedInAt?: string;
  checkedInBy?: string;
  rank?: number;
  screeningScore?: number;
  attendee?: any;
}

// Synthesize audio feedback via Web Audio API (100% offline, zero assets required)
function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  } catch {
    return null;
  }
}

function playTone(freq: number, type: OscillatorType, durationMs: number, delayMs = 0) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delayMs / 1000);

    gain.gain.setValueAtTime(0.15, ctx.currentTime + delayMs / 1000);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (delayMs + durationMs) / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delayMs / 1000);
    osc.stop(ctx.currentTime + (delayMs + durationMs) / 1000);
  } catch {
    // Audio context may be restricted by browser policy before first interaction
  }
}

function playScanBeep() {
  playTone(880, "sine", 70); // High pitch crisp beep
}

function playApproveChime() {
  playTone(587.33, "sine", 100, 0); // D5
  playTone(880.0, "sine", 150, 100); // A5
}

function playRejectBuzz() {
  playTone(220, "sawtooth", 180, 0); // Low warning buzz
}

function parseQrOrCode(rawInput: string): string {
  const clean = rawInput.trim();
  if (clean.startsWith("CCC-PASS:")) {
    const parts = clean.split(":");
    if (parts.length >= 2) {
      return parts[1].trim();
    }
  }
  return clean;
}

export function GateScannerPanel({
  selectedContestSlug,
  proctorName,
  onPassCheckedIn,
  recentScans = [],
  attendees = [],
}: GateScannerPanelProps) {
  // Scanner hardware state
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningPaused, setIsScanningPaused] = useState(false);

  // Review Modal State
  const [pendingCadet, setPendingCadet] = useState<PendingCadetReview | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // Manual input fallback state
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Local state for last processed scan for banner
  const [lastProcessed, setLastProcessed] = useState<any>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceScanLock = useRef<boolean>(false);

  // Initialize and manage camera stream
  const startCamera = useCallback(async (cameraIdOrConfig?: any) => {
    setCameraError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("ccc-gate-qr-reader");
      }

      const scanner = scannerRef.current;
      if (scanner.isScanning) {
        await scanner.stop();
      }

      const config = cameraIdOrConfig || { facingMode: "environment" };

      await scanner.start(
        config,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleQrDetected(decodedText);
        },
        () => {
          // Frame error callback - silent frame scan
        }
      );

      setIsCameraActive(true);
      setIsScanningPaused(false);
    } catch (err: any) {
      console.warn("Failed to initialize camera scanner:", err);
      setCameraError(
        err?.message || "Camera access unavailable. Grant permission or use manual/upload input."
      );
      setIsCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      setIsCameraActive(false);
    } catch {
      // Ignore stop errors
    }
  }, []);

  // Fetch available cameras on mount and auto-start
  useEffect(() => {
    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        setCameras(devices || []);
        if (devices && devices.length > 0) {
          // Prefer back/environment camera if labeled, else device 0
          const backCam = devices.find((d) =>
            /back|rear|environment/i.test(d.label)
          );
          const chosenId = backCam?.id || devices[devices.length - 1]?.id || devices[0]?.id;
          setActiveCameraId(chosenId);
          startCamera(chosenId);
        } else {
          startCamera({ facingMode: "environment" });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Camera enumeration warning:", err);
        startCamera({ facingMode: "environment" });
      });

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current.clear();
      }
    };
  }, [startCamera]);

  // Handle QR code read
  const handleQrDetected = useCallback(
    (rawDecoded: string) => {
      if (debounceScanLock.current || isScanningPaused || pendingCadet) {
        return;
      }

      debounceScanLock.current = true;
      if (soundEnabled) {
        playScanBeep();
      }

      // Temporarily pause scanner feed while review modal is open
      try {
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.pause(true);
          setIsScanningPaused(true);
        }
      } catch {
        // Safe pause
      }

      const parsedCode = parseQrOrCode(rawDecoded);

      // Look up candidate from loaded attendees roster
      const matched = attendees.find((a) => {
        const pCode = (a.pass_code || "").trim().toLowerCase();
        const pQr = (a.qr_data || "").trim().toLowerCase();
        const pHandle = (a.handle || "").trim().toLowerCase();
        const target = parsedCode.toLowerCase();
        const targetRaw = rawDecoded.toLowerCase();
        return (
          pCode === target ||
          pQr === target ||
          pQr === targetRaw ||
          pHandle === target ||
          targetRaw.includes(pCode)
        );
      });

      const reviewItem: PendingCadetReview = {
        raw: rawDecoded,
        passCode: matched?.pass_code || parsedCode,
        seatNumber: matched?.seat_number || "WS-AUTO",
        candidateName:
          matched?.full_name || matched?.member_name || (matched?.handle ? `@${matched.handle}` : "Cadet"),
        handle: matched?.handle || "cadet",
        department: matched?.department || "CSE",
        enrollmentNumber: matched?.enrollment_number,
        batch: matched?.batch || "2023-27",
        checkInStatus: matched?.check_in_status || "issued",
        checkedInAt: matched?.checked_in_at,
        checkedInBy: matched?.checked_in_by,
        rank: matched?.rank,
        screeningScore: matched?.screening_score,
        attendee: matched,
      };

      setPendingCadet(reviewItem);
    },
    [attendees, isScanningPaused, pendingCadet, soundEnabled]
  );

  // Resume camera with debounce so user doesn't immediately rescan the same QR code
  const resumeScanner = useCallback(() => {
    setPendingCadet(null);
    setIsActionPending(false);

    setTimeout(() => {
      try {
        if (scannerRef.current) {
          scannerRef.current.resume();
          setIsScanningPaused(false);
        }
      } catch {
        // If not paused, ensure camera runs
      }
      setTimeout(() => {
        debounceScanLock.current = false;
      }, 1000);
    }, 400);
  }, []);

  // Proctor Action: APPROVE
  const handleApprove = async () => {
    if (!pendingCadet) return;
    setIsActionPending(true);

    try {
      const res = await triggerWebhookGateScan(
        pendingCadet.passCode || pendingCadet.raw,
        proctorName,
        selectedContestSlug
      );

      if (res.valid) {
        if (soundEnabled) playApproveChime();
        toast.success(
          `APPROVED: ${pendingCadet.candidateName} admitted to Workstation ${
            res.seat_number || pendingCadet.seatNumber
          }`
        );
        setLastProcessed({
          valid: true,
          candidate_name: pendingCadet.candidateName,
          handle: pendingCadet.handle,
          seat_number: res.seat_number || pendingCadet.seatNumber,
          pass_code: pendingCadet.passCode,
          time: new Date().toLocaleTimeString(),
        });
        if (onPassCheckedIn) {
          onPassCheckedIn(res);
        }
      } else {
        if (soundEnabled) playRejectBuzz();
        toast.error(`Check-in rejected: ${res.reason || "Invalid pass"}`);
        setLastProcessed({
          valid: false,
          reason: res.reason || "Invalid pass",
          candidate_name: pendingCadet.candidateName,
        });
      }
    } catch (err: any) {
      if (soundEnabled) playRejectBuzz();
      toast.error(err.message || "Failed to process approval.");
      setLastProcessed({
        valid: false,
        reason: err.message || "Server error during approval.",
        candidate_name: pendingCadet.candidateName,
      });
    } finally {
      resumeScanner();
    }
  };

  // Proctor Action: REJECT
  const handleReject = () => {
    if (!pendingCadet) return;
    if (soundEnabled) playRejectBuzz();

    toast.error(
      `DENIED: Entry refused for ${pendingCadet.candidateName} (${pendingCadet.passCode})`
    );

    setLastProcessed({
      valid: false,
      reason: "Proctor Denied Admittance",
      candidate_name: pendingCadet.candidateName,
      handle: pendingCadet.handle,
      seat_number: pendingCadet.seatNumber,
      pass_code: pendingCadet.passCode,
      time: new Date().toLocaleTimeString(),
    });

    resumeScanner();
  };

  // Keyboard shortcut listener for Modal (Enter/A = Approve, Esc/R = Reject)
  useEffect(() => {
    if (!pendingCadet) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPending) return;

      if (e.key === "Enter" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleApprove();
      } else if (e.key === "Escape" || e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleReject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingCadet, isActionPending]);

  // Handle image upload QR scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("ccc-gate-qr-reader");
      }
      const result = await scannerRef.current.scanFile(file, true);
      handleQrDetected(result);
    } catch (err: any) {
      toast.error("No valid QR code detected in the uploaded image.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Switch between front/back or external USB cameras
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) {
      toast.info("Only one camera device detected on this workstation.");
      return;
    }
    const currIdx = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIdx = (currIdx + 1) % cameras.length;
    const nextCam = cameras[nextIdx];
    setActiveCameraId(nextCam.id);
    startCamera(nextCam.id);
    toast.info(`Switched to: ${nextCam.label || `Camera ${nextIdx + 1}`}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
      {/* Hidden File Input for QR Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Left: Camera Optical Scanner Viewfinder */}
      <div className="lg:col-span-7 space-y-4">
        <Card className="bg-zinc-950 border border-white/10 rounded-none overflow-hidden">
          <CardHeader className="border-b border-white/10 py-2.5 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-lime-400" />
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-white font-bold">
                  Camera QR Scanner
                </CardTitle>
              </div>

              <div className="flex items-center gap-2">
                {cameras.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSwitchCamera}
                    className="h-7 px-2 border-white/10 bg-zinc-900 text-zinc-300 hover:text-white text-xs font-mono rounded-none"
                  >
                    <SwitchCamera className="w-3 h-3 mr-1 text-lime-400" />
                    Flip
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-2 border-white/10 bg-zinc-900 text-zinc-300 hover:text-white text-xs font-mono rounded-none"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Upload
                </Button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Mute audio" : "Unmute audio"}
                  className="p-1.5 bg-black border border-white/10 text-zinc-400 hover:text-white rounded-none cursor-pointer transition-colors"
                >
                  {soundEnabled ? <Volume2 className="w-3 h-3 text-lime-400" /> : <VolumeX className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            {/* Viewfinder Frame */}
            <div className="relative w-full max-w-[360px] mx-auto bg-black border border-white/15 overflow-hidden">
              {/* HTML5 QR Code Mount Element */}
              <div
                id="ccc-gate-qr-reader"
                className="w-full aspect-square bg-black flex items-center justify-center overflow-hidden"
              />

              {/* Minimal Focus Corners */}
              <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-t-2 border-l-2 border-lime-400" />
                  <span className="w-3 h-3 border-t-2 border-r-2 border-lime-400" />
                </div>
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-b-2 border-l-2 border-lime-400" />
                  <span className="w-3 h-3 border-b-2 border-r-2 border-lime-400" />
                </div>
              </div>

              {/* Camera Error / Fallback State Overlay */}
              {cameraError && (
                <div className="absolute inset-0 bg-black/95 p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <CameraOff className="w-8 h-8 text-rose-400" />
                  <div className="text-white font-bold text-xs uppercase">
                    Camera Inactive
                  </div>
                  <p className="text-[11px] text-zinc-400 max-w-xs">
                    {cameraError}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => startCamera()}
                      className="bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-bold rounded-none h-8"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-white/15 text-zinc-300 hover:text-white font-mono text-xs rounded-none h-8"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Upload QR
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Code Fallback */}
            <div className="pt-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="text-xs font-mono text-zinc-400 hover:text-lime-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Keyboard className="w-3 h-3" />
                  <span>{showManualInput ? "Hide manual entry" : "Enter code manually"}</span>
                </button>
              </div>

              {showManualInput && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualCode.trim()) {
                      handleQrDetected(manualCode.trim());
                      setManualCode("");
                    }
                  }}
                  className="mt-2 flex gap-2"
                >
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Pass code or @handle"
                    className="h-8 bg-black border-white/15 text-xs font-mono text-white rounded-none focus-visible:ring-2 focus-visible:ring-lime-400"
                  />
                  <Button
                    type="submit"
                    className="h-8 bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-bold rounded-none px-3"
                  >
                    Check
                  </Button>
                </form>
              )}
            </div>

            {/* Last Processed Result Banner */}
            {lastProcessed && (
              <div
                className={`p-3 border rounded-none flex items-center justify-between text-xs font-mono ${
                  lastProcessed.valid
                    ? "bg-lime-400/10 border-lime-400/30 text-lime-300"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {lastProcessed.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {lastProcessed.valid
                      ? `Admitted: ${lastProcessed.candidate_name} → ${lastProcessed.seat_number}`
                      : `Denied: ${lastProcessed.candidate_name} (${lastProcessed.reason})`}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 tabular-nums">
                  {lastProcessed.time}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Live Stream of Recent Admittances */}
      <div className="lg:col-span-5 space-y-4">
        <Card className="bg-zinc-950 border border-white/10 rounded-none">
          <CardHeader className="border-b border-white/10 py-2.5 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-lime-400" />
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-white font-bold">
                  Recent Scans
                </CardTitle>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                {recentScans.length}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-3">
            {recentScans.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 space-y-1 font-mono">
                <QrCode className="w-6 h-6 mx-auto text-zinc-600" />
                <p className="text-xs">Awaiting gate scans</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1 font-mono">
                {recentScans.map((scan, idx) => (
                  <div
                    key={scan.pass_code || scan.id || idx}
                    className="p-2.5 bg-black border border-white/10 rounded-none flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate">
                          {scan.candidate_name || scan.handle || "Cadet"}
                        </span>
                        <span className="text-[10px] text-zinc-400">@{scan.handle || "cadet"}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 tabular-nums">
                        {scan.checked_in_at
                          ? new Date(scan.checked_in_at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : "Just now"}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 bg-lime-400/10 text-lime-400 border border-lime-400/30 text-[10px] font-bold">
                        {scan.seat_number || "WS-OK"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── CLEARANCE REVIEW MODAL: APPROVE OR REJECT ─────────────── */}
      {pendingCadet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
          <div className="w-full max-w-md bg-zinc-950 border border-white/20 p-5 rounded-none shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs uppercase font-bold text-white tracking-wider">
                Gate Clearance Review
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {pendingCadet.passCode}
              </span>
            </div>

            {/* Candidate & Seat Info */}
            <div className="p-3.5 bg-black border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase text-zinc-500 font-bold block">Assigned Seat</span>
                <div className="text-2xl font-extrabold text-lime-400 tabular-nums">
                  {pendingCadet.seatNumber}
                </div>
              </div>
              <div className="text-right min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {pendingCadet.candidateName}
                </div>
                <div className="text-xs text-zinc-400">
                  @{pendingCadet.handle} · {pendingCadet.department}
                </div>
              </div>
            </div>

            {/* Warning if already checked in */}
            {pendingCadet.checkInStatus === "checked_in" && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Already checked in{pendingCadet.checkedInAt ? ` at ${new Date(pendingCadet.checkedInAt).toLocaleTimeString()}` : ""}.
                </span>
              </div>
            )}

            {/* Action Buttons: APPROVE or REJECT */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={isActionPending}
                  className="w-full bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-bold tracking-wider h-11 rounded-none cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400 flex items-center justify-center gap-1.5"
                >
                  {isActionPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  )}
                  Approve
                </Button>

                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isActionPending}
                  className="w-full border-rose-500/40 bg-zinc-900 text-rose-300 hover:bg-rose-600 hover:text-white hover:border-rose-600 font-mono text-xs uppercase font-bold tracking-wider h-11 rounded-none cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reject
                </Button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
                <span>[Enter] or [A] Approve</span>
                <span>[Esc] or [R] Reject</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
