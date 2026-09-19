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
      <div className="lg:col-span-7 space-y-6">
        <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="font-mono text-sm uppercase tracking-wide text-white font-extrabold">
                    Live Gate Optical Scanner
                  </CardTitle>
                  <p className="text-[11px] text-zinc-400">
                    Real-time video feed decoder · Instant candidate credential review
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Mute audio cues" : "Unmute audio cues"}
                  className="p-1.5 bg-black border border-white/10 text-zinc-400 hover:text-white hover:border-lime-400/40 rounded-none cursor-pointer transition-colors"
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-lime-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                <Badge
                  variant="outline"
                  className="font-mono text-[10px] uppercase bg-lime-400/10 border-lime-400/30 text-lime-400 font-bold px-2 py-0.5 rounded-none tracking-widest"
                >
                  <span className="w-1.5 h-1.5 bg-lime-400 animate-ping inline-block mr-1.5" />
                  SENSOR ACTIVE
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Viewfinder Frame with Cyber HUD Overlays */}
            <div className="relative w-full max-w-[420px] mx-auto bg-black border-2 border-white/15 overflow-hidden">
              {/* HTML5 QR Code Mount Element */}
              <div
                id="ccc-gate-qr-reader"
                className="w-full aspect-square bg-black flex items-center justify-center overflow-hidden"
              />

              {/* Viewfinder Cyber Corner Brackets */}
              <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="w-4 h-4 border-t-2 border-l-2 border-lime-400" />
                  <div className="bg-black/80 px-2 py-0.5 border border-white/10 text-[9px] text-lime-400 font-bold tracking-widest">
                    [10 FPS · AUTO-DETECT]
                  </div>
                  <span className="w-4 h-4 border-t-2 border-r-2 border-lime-400" />
                </div>

                {/* Animated Horizontal Scan Laser Beam */}
                {isCameraActive && !isScanningPaused && (
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-lime-400 to-transparent shadow-[0_0_12px_#CCFF00] animate-pulse" />
                )}

                <div className="flex justify-between items-end">
                  <span className="w-4 h-4 border-b-2 border-l-2 border-lime-400" />
                  <div className="bg-black/80 px-2 py-0.5 border border-white/10 text-[9px] text-zinc-400 font-mono">
                    POINT AT CANDIDATE QR
                  </div>
                  <span className="w-4 h-4 border-b-2 border-r-2 border-lime-400" />
                </div>
              </div>

              {/* Camera Error / Fallback State Overlay */}
              {cameraError && (
                <div className="absolute inset-0 bg-black/95 p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <CameraOff className="w-10 h-10 text-rose-400 animate-pulse" />
                  <div className="text-white font-bold text-xs uppercase">
                    Optical Sensor Restricted
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs">
                    {cameraError}
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => startCamera()}
                      className="bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-bold rounded-none"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Retry Camera
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-white/15 text-zinc-300 hover:text-white font-mono text-xs rounded-none"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload QR
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Control Strip */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-2">
                {cameras.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSwitchCamera}
                    className="h-8 border-white/15 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-mono rounded-none"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 mr-1 text-lime-400" />
                    Flip Camera
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 border-white/15 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-mono rounded-none"
                >
                  <Upload className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                  Upload Image
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-xs font-mono text-zinc-400 hover:text-lime-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>{showManualInput ? "Hide Code Entry" : "Type Pass Code"}</span>
              </button>
            </div>

            {/* Collapsible Manual Code Input Barcode Gun Fallback */}
            {showManualInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCode.trim()) {
                    handleQrDetected(manualCode.trim());
                    setManualCode("");
                  }
                }}
                className="p-3 bg-black border border-white/10 rounded-none space-y-2"
              >
                <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Manual Laser Gun / Code Entry:
                </label>
                <div className="flex gap-2">
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. CCC-PASS-TOP30-01 or student handle"
                    className="h-9 bg-zinc-950 border-white/15 text-xs font-mono text-white rounded-none focus-visible:ring-2 focus-visible:ring-lime-400"
                  />
                  <Button
                    type="submit"
                    className="h-9 bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-extrabold rounded-none px-3"
                  >
                    Review Pass
                  </Button>
                </div>
              </form>
            )}

            {/* Quick Test Barcodes for Rapid Proctor Verification */}
            <div className="p-3 bg-black border border-white/10 space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Quick Simulation Targets:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {["CCC-PASS-TOP30-01", "CCC-PASS-TOP30-02", "CCC-PASS-INVALID"].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => handleQrDetected(sample)}
                    className="text-[10px] font-mono text-zinc-400 hover:text-lime-400 border border-white/10 hover:border-lime-400/40 px-2 py-1 rounded-none bg-zinc-950 cursor-pointer transition-colors"
                  >
                    Simulate {sample}
                  </button>
                ))}
              </div>
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
      <div className="lg:col-span-5 space-y-6">
        <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-2xl">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-lime-400" />
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-white font-extrabold">
                  Live Gate Event Stream
                </CardTitle>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                {recentScans.length} events
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {recentScans.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 space-y-2 font-mono">
                <QrCode className="w-8 h-8 mx-auto text-zinc-700 animate-pulse" />
                <p className="text-xs">Awaiting optical scans at turnstile...</p>
                <p className="text-[10px] text-zinc-600">
                  When candidates scan, an inspection dialog will prompt for approval.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 font-mono">
                {recentScans.map((scan, idx) => (
                  <div
                    key={scan.pass_code || scan.id || idx}
                    className="p-3 bg-black border border-white/10 rounded-none flex items-center justify-between gap-3 text-xs hover:border-lime-400/30 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate">
                          {scan.candidate_name || scan.handle || "Cadet"}
                        </span>
                        <span className="text-[10px] text-lime-400">@{scan.handle || "cadet"}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                        <span>Code: {scan.pass_code}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {scan.checked_in_at
                            ? new Date(scan.checked_in_at).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "Just now"}
                        </span>
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

      {/* ========================================================================= */}
      {/* CLEARANCE REVIEW MODAL: APPROVE OR REJECT                                 */}
      {/* ========================================================================= */}
      {pendingCadet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
          <div className="w-full max-w-lg bg-zinc-950 border-2 border-lime-400 p-6 sm:p-7 rounded-none shadow-2xl space-y-6 relative">
            {/* Corner Crosshairs */}
            <span className="absolute -top-1.5 -left-1.5 text-lime-400 font-mono text-sm leading-none select-none">
              +
            </span>
            <span className="absolute -top-1.5 -right-1.5 text-lime-400 font-mono text-sm leading-none select-none">
              +
            </span>
            <span className="absolute -bottom-1.5 -left-1.5 text-lime-400 font-mono text-sm leading-none select-none">
              +
            </span>
            <span className="absolute -bottom-1.5 -right-1.5 text-lime-400 font-mono text-sm leading-none select-none">
              +
            </span>

            {/* Modal Header */}
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-lime-400/10 border border-lime-400/40 flex items-center justify-center text-lime-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                      (01 // GATE CLEARANCE REVIEW)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Cryptographic pass detected · Proctor verification required
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="bg-zinc-900 border-white/15 text-zinc-300 text-[10px] uppercase font-mono px-2 py-0.5 rounded-none"
                >
                  TURNSTILE 01
                </Badge>
              </div>
            </div>

            {/* Workstation Seat Assignment Spotlight */}
            <div className="p-4 bg-black border border-lime-400/40 rounded-none flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-lime-400 block">
                  PHYSICAL LAB WORKSTATION
                </span>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {pendingCadet.seatNumber}
                </div>
                <div className="text-[11px] text-zinc-400">
                  Lab 04 Air-Gapped Terminal
                </div>
              </div>

              <div className="text-right">
                <div className="w-12 h-12 rounded-none bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400 ml-auto">
                  <MapPin className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Candidate Dossier Card */}
            <div className="p-4 bg-zinc-900/60 border border-white/10 rounded-none space-y-3 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white font-bold text-base">
                    {pendingCadet.candidateName}
                  </div>
                  <div className="text-lime-400 text-xs mt-0.5 flex items-center gap-2">
                    <span>@{pendingCadet.handle}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-300">{pendingCadet.department}</span>
                  </div>
                </div>

                {pendingCadet.rank && (
                  <Badge className="bg-zinc-950 border-white/20 text-zinc-200 text-[11px] font-mono rounded-none">
                    Rank #{pendingCadet.rank}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px]">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase">
                    Pass Code:
                  </span>
                  <span className="text-white font-bold select-all">
                    {pendingCadet.passCode}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase">
                    Enrollment No:
                  </span>
                  <span className="text-white font-bold">
                    {pendingCadet.enrollmentNumber || "EN23CS301927"}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning if already checked in */}
            {pendingCadet.checkInStatus === "checked_in" && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-none flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold uppercase tracking-wide">
                    Warning: Pass Previously Admitted
                  </div>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    This credential was already scanned{" "}
                    {pendingCadet.checkedInAt
                      ? `at ${new Date(pendingCadet.checkedInAt).toLocaleTimeString()}`
                      : ""}{" "}
                    {pendingCadet.checkedInBy ? `by ${pendingCadet.checkedInBy}` : ""}.
                    Approving will re-authorize admittance.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons: APPROVE or REJECT */}
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* APPROVE BUTTON */}
                <Button
                  onClick={handleApprove}
                  disabled={isActionPending}
                  className="w-full bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-black tracking-wider h-12 rounded-none shadow-lg shadow-lime-400/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400 flex items-center justify-center gap-1.5"
                >
                  {isActionPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                  )}
                  APPROVE (ADMIT)
                </Button>

                {/* REJECT BUTTON */}
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isActionPending}
                  className="w-full border-rose-500/60 bg-zinc-900 text-rose-300 hover:bg-rose-600 hover:text-white hover:border-rose-600 font-mono text-xs uppercase font-extrabold tracking-wider h-12 rounded-none cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  REJECT (DENY)
                </Button>
              </div>

              {/* Keyboard Shortcuts Hint */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 pt-1">
                <span>[Enter] or [A] to Approve</span>
                <span>[Esc] or [R] to Reject</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
