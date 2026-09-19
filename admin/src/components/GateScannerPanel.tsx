import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Users,
  Monitor,
  Check,
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
  const [isScannerOpen, setIsScannerOpen] = useState(true);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Review Modal State
  const [pendingCadet, setPendingCadet] = useState<PendingCadetReview | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // Manual input state
  const [manualCode, setManualCode] = useState("");

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Local state for last processed scan for banner
  const [lastProcessed, setLastProcessed] = useState<any>(null);

  // Selected workstation for inspection
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceScanLock = useRef<boolean>(false);

  // Workstation mapping (WS-01 to WS-30)
  const workstationMap = useMemo(() => {
    const map = new Map<string, any>();
    attendees.forEach((att) => {
      if (att.seat_number) {
        const norm = att.seat_number.toUpperCase().trim();
        map.set(norm, att);
      }
    });
    return map;
  }, [attendees]);

  // Turnstile metrics
  const checkedInCount = attendees.filter((a) => a.check_in_status === "checked_in").length;
  const totalCapacity = attendees.length || 30;
  const remainingSeats = Math.max(0, totalCapacity - checkedInCount);
  const occupancyPercent = Math.round((checkedInCount / totalCapacity) * 100);

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

      const config = {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      };

      const cameraSelection = cameraIdOrConfig || { facingMode: "environment" };

      await scanner.start(
        cameraSelection,
        config,
        (decodedText) => {
          handleQrDetected(decodedText);
        },
        () => {
          // Ignore recurring frame scan failures
        }
      );
    } catch (err: any) {
      console.warn("Camera init error:", err);
      setCameraError(err.message || "Failed to initialize camera sensor.");
    }
  }, []);

  // Stop camera hardware stream
  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (err) {
      console.warn("Camera stop error:", err);
    }
  }, []);

  // Toggle privacy shutter
  const handleToggleScanner = async () => {
    if (isScannerOpen) {
      await stopCamera();
      setIsScannerOpen(false);
      toast.info("Scanner camera shutter closed (Privacy Mode Active).");
    } else {
      setIsScannerOpen(true);
      setTimeout(() => {
        startCamera(activeCameraId || undefined);
      }, 100);
      toast.success("Scanner camera hardware activated.");
    }
  };

  // Enumerate cameras on mount
  useEffect(() => {
    let isMounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        setCameras(devices || []);
        if (devices && devices.length > 0) {
          const backCam = devices.find((d) => d.label.toLowerCase().includes("back")) || devices[0];
          setActiveCameraId(backCam.id);
          if (isScannerOpen) {
            startCamera(backCam.id);
          }
        } else {
          setCameraError("No hardware camera device found on this system.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setCameraError("Camera permission denied or camera device unavailable.");
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  // QR Code Detected Handler
  const handleQrDetected = useCallback(
    (scannedText: string) => {
      if (debounceScanLock.current) return;
      debounceScanLock.current = true;

      if (soundEnabled) playScanBeep();

      const parsedCode = parseQrOrCode(scannedText);
      const cleanUpper = parsedCode.toUpperCase();

      // Find candidate in attendees roster
      const matched = attendees.find((a) => {
        const passMatch = (a.pass_code || "").toUpperCase() === cleanUpper;
        const handleMatch =
          (a.handle || "").toUpperCase() === cleanUpper ||
          `@${(a.handle || "").toUpperCase()}` === cleanUpper;
        const qrMatch = (a.qr_data || "").toUpperCase().includes(cleanUpper);
        return passMatch || handleMatch || qrMatch;
      });

      const candidateName = matched?.member_name || matched?.full_name || "Unregistered Candidate";
      const handle = matched?.handle || parsedCode;
      const seatNumber = matched?.seat_number || "WS-AUTO";
      const department = matched?.department || "Computer Science & Engineering";
      const checkInStatus = matched?.check_in_status || "issued";

      setPendingCadet({
        raw: scannedText,
        passCode: parsedCode,
        seatNumber,
        candidateName,
        handle,
        department,
        enrollmentNumber: matched?.enrollment_number,
        batch: matched?.batch || "2024-2028",
        checkInStatus,
        checkedInAt: matched?.checked_in_at,
        checkedInBy: matched?.checked_in_by,
        rank: matched?.rank || 1,
        screeningScore: matched?.screening_score || 100,
        attendee: matched,
      });

      // Pause scanning while review modal is open
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.pause(true);
      }
    },
    [attendees, soundEnabled]
  );

  // Resume camera scanning after review
  const resumeScanning = useCallback(() => {
    setPendingCadet(null);
    setIsActionPending(false);
    setTimeout(() => {
      debounceScanLock.current = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.resume();
        } catch {
          // Scanner may already be running
        }
      }
    }, 800);
  }, []);

  // Approve Cadet Clearance
  const handleApprove = async () => {
    if (!pendingCadet) return;
    setIsActionPending(true);

    try {
      const res = await triggerWebhookGateScan(
        pendingCadet.passCode,
        proctorName,
        selectedContestSlug
      );

      if (res.valid) {
        if (soundEnabled) playApproveChime();
        toast.success(
          `Cadet Admitted: ${pendingCadet.candidateName} assigned to ${res.seat_number || pendingCadet.seatNumber}`
        );
        setLastProcessed({
          valid: true,
          candidate_name: pendingCadet.candidateName,
          seat_number: res.seat_number || pendingCadet.seatNumber,
          time: new Date().toLocaleTimeString(),
        });
        onPassCheckedIn?.(res);
      } else {
        if (soundEnabled) playRejectBuzz();
        const reasonText = res.message || res.reason || "Invalid pass credentials";
        toast.error(`Check-in rejected: ${reasonText}`);
        setLastProcessed({
          valid: false,
          candidate_name: pendingCadet.candidateName,
          reason: reasonText,
          time: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to commit turnstile admission.");
    } finally {
      resumeScanning();
    }
  };

  // Reject Entry
  const handleReject = () => {
    if (!pendingCadet) return;
    if (soundEnabled) playRejectBuzz();
    toast.error(`Entry denied for candidate: ${pendingCadet.candidateName}`);
    setLastProcessed({
      valid: false,
      candidate_name: pendingCadet.candidateName,
      reason: "Proctor Refused Clearance",
      time: new Date().toLocaleTimeString(),
    });
    resumeScanning();
  };

  // Keyboard shortcuts for modal approval/rejection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingCadet || isActionPending) return;
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
    <div className="space-y-6 font-mono">
      {/* Hidden File Input for QR Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ─── 1. TOP GATE TELEMETRY STRIP ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-white/[0.08] p-3.5 space-y-1 bg-[#111111]">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3 h-3 text-lime-400" />
            ADMITTED FINALISTS
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white tabular-nums">
              {checkedInCount}{" "}
              <span className="text-xs font-normal text-zinc-500">/ {totalCapacity}</span>
            </span>
            <span className="text-lime-400 text-xs font-bold tabular-nums">{occupancyPercent}%</span>
          </div>
          <div className="w-full bg-zinc-900 h-1 overflow-hidden">
            <div className="bg-lime-400 h-full" style={{ width: `${occupancyPercent}%` }} />
          </div>
        </div>

        <div className="border border-white/[0.08] p-3.5 space-y-1 bg-[#111111]">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Monitor className="w-3 h-3 text-cyan-400" />
            REMAINING TERMINALS
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-cyan-400 tabular-nums">{remainingSeats}</span>
            <span className="text-xs text-zinc-500 uppercase">Available</span>
          </div>
          <p className="text-[10px] text-zinc-500 truncate">Lab 04 Air-Gapped WS-01…30</p>
        </div>

        <div className="border border-white/[0.08] p-3.5 space-y-1 bg-[#111111]">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            THROUGHPUT RATE
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white tabular-nums">
              {recentScans.length > 0 ? "~12" : "0"}{" "}
              <span className="text-xs font-normal text-zinc-500">s/cadet</span>
            </span>
            <span className="text-emerald-400 text-[10px] font-bold">OPTIMAL</span>
          </div>
          <p className="text-[10px] text-zinc-500 truncate">Zero latency optical match</p>
        </div>

        <div className="border border-white/[0.08] p-3.5 space-y-1 bg-[#111111]">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-lime-400" />
            GATE SENSOR STATUS
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-sm font-bold uppercase truncate ${
                isScannerOpen ? "text-lime-400" : "text-amber-400"
              }`}
            >
              {isScannerOpen ? "AUTO-DETECT ACTIVE" : "SHUTTER CLOSED"}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 truncate">
            {isScannerOpen ? "Camera optical feed live" : "Hardware disconnected"}
          </p>
        </div>
      </div>

      {/* ─── 2. MAIN SPLIT: OPTICAL SCANNER VIEWPORT + WORKSTATION MATRIX ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7-Cols: Optical Targeting Console */}
        <div className="lg:col-span-7 space-y-4">
          <div className="border border-white/[0.08] p-5 bg-[#111111] space-y-4">
            {/* Header & Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-lime-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Live Camera Optical Viewfinder
                </span>
                <span className="text-[10px] bg-lime-400/10 text-lime-400 border border-lime-400/30 px-1.5 py-0.5">
                  10 FPS
                </span>
              </div>

              {/* Hardware Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleScanner}
                  className={`h-8 px-3 text-xs uppercase font-bold cursor-pointer ${
                    isScannerOpen
                      ? "border-amber-500/40 bg-zinc-950 text-amber-300 hover:bg-zinc-900"
                      : "bg-lime-400 hover:bg-lime-300 text-black border-lime-400 font-extrabold shadow-[0_0_10px_rgba(204,255,0,0.3)]"
                  }`}
                >
                  {isScannerOpen ? (
                    <>
                      <CameraOff className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                      Close Shutter
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 mr-1.5" />
                      Open Camera
                    </>
                  )}
                </Button>

                {isScannerOpen && cameras.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSwitchCamera}
                    className="h-8 px-2.5 border-white/15 bg-zinc-900 text-zinc-300 hover:text-white text-xs"
                    title="Switch camera device"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 mr-1 text-lime-400" />
                    Flip
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-2.5 border-white/15 bg-zinc-900 text-zinc-300 hover:text-white text-xs"
                  title="Upload QR Image"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Upload
                </Button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Mute audio cues" : "Enable audio cues"}
                  className="h-8 w-8 flex items-center justify-center bg-zinc-900 border border-white/15 text-zinc-400 hover:text-white cursor-pointer"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-lime-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Viewfinder Frame */}
            <div className="relative w-full aspect-4/3 max-w-[540px] mx-auto bg-black border border-white/15 overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]">
              {/* HTML5 QR Mount Point */}
              <div
                id="ccc-gate-qr-reader"
                className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
              />

              {/* Tactical Corner Reticle & Laser Sweep (Active when open) */}
              {isScannerOpen && (
                <>
                  <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-t-2 border-l-2 border-lime-400 shadow-[0_0_8px_#CCFF00]" />
                      <span className="w-5 h-5 border-t-2 border-r-2 border-lime-400 shadow-[0_0_8px_#CCFF00]" />
                    </div>
                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-b-2 border-l-2 border-lime-400 shadow-[0_0_8px_#CCFF00]" />
                      <span className="w-5 h-5 border-b-2 border-r-2 border-lime-400 shadow-[0_0_8px_#CCFF00]" />
                    </div>
                  </div>

                  {/* Animated Laser Beam */}
                  <div className="absolute left-0 right-0 h-[1.5px] bg-[#ccff00] shadow-[0_0_10px_1px_#ccff00] animate-pulse pointer-events-none" />

                  {/* Telemetry Tag */}
                  <div className="absolute bottom-2 left-3 text-[10px] text-lime-400 bg-black/80 border border-lime-400/30 px-2 py-0.5 tracking-wider">
                    [ AUTO-TARGETING CADET QR PASS ]
                  </div>
                </>
              )}

              {/* Privacy Shutter Closed State */}
              {!isScannerOpen && (
                <div className="absolute inset-0 bg-[#111111] flex flex-col items-center justify-center text-center p-6 space-y-3 z-10">
                  <div className="w-14 h-14 bg-black border border-white/10 flex items-center justify-center">
                    <CameraOff className="w-7 h-7 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-white tracking-wider">
                      Scanner Closed (Privacy Mode)
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-[280px]">
                      Camera hardware stream is disconnected. Click below to resume turnstile operations.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleToggleScanner}
                    className="h-9 px-4 bg-lime-400 hover:bg-lime-300 text-black text-xs uppercase font-bold shadow-[0_0_12px_rgba(204,255,0,0.3)] cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    Open Camera Scanner
                  </Button>
                </div>
              )}

              {/* Camera Inactive Fallback */}
              {isScannerOpen && cameraError && (
                <div className="absolute inset-0 bg-black/95 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
                  <CameraOff className="w-8 h-8 text-rose-400" />
                  <div className="text-white font-bold text-xs uppercase">Camera Sensor Inactive</div>
                  <p className="text-xs text-zinc-400 max-w-xs">{cameraError}</p>
                  <Button
                    size="sm"
                    onClick={() => startCamera()}
                    className="h-8 bg-zinc-900 border border-white/15 text-xs text-white hover:bg-lime-400 hover:text-black"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry Camera Connection
                  </Button>
                </div>
              )}
            </div>

            {/* Quick Pass Code or Handle Search Bar */}
            <div className="pt-2 border-t border-white/10">
              <div className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-lime-400" />
                  Manual Pass Code or Handle Search:
                </span>
                <span className="text-[10px] text-zinc-500">Press [Enter] to inspect</span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCode.trim()) {
                    handleQrDetected(manualCode.trim());
                    setManualCode("");
                  }
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter pass code (e.g. CCC-PASS:W1-01) or @handle"
                    className="h-9 pl-9 bg-black border-white/15 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-lime-400"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-9 bg-lime-400 hover:bg-lime-300 text-black text-xs uppercase font-bold px-4 cursor-pointer"
                >
                  Inspect Cadet
                </Button>
              </form>
            </div>

            {/* Last Processed Result Banner */}
            {lastProcessed && (
              <div
                className={`p-3 border flex items-center justify-between text-xs ${
                  lastProcessed.valid
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {lastProcessed.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {lastProcessed.valid
                      ? `Admitted: ${lastProcessed.candidate_name} → Station ${lastProcessed.seat_number}`
                      : `Denied: ${lastProcessed.candidate_name} (${lastProcessed.reason})`}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 tabular-nums">{lastProcessed.time}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 5-Cols: Workstation Floor Matrix & Recent Scans */}
        <div className="lg:col-span-5 space-y-4">
          {/* Interactive Air-Gapped Workstation Grid (Lab 04) */}
          <div className="border border-white/[0.08] p-4 bg-[#111111] space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-lime-400" />
                Lab 04 Terminal Workstations (30 Seats)
              </span>
              <span className="text-[10px] text-zinc-400 tabular-nums">
                {checkedInCount} OCCUPIED / {totalCapacity} TOTAL
              </span>
            </div>

            {/* 6x5 Grid of Workstations */}
            <div className="grid grid-cols-6 gap-1.5 pt-1">
              {Array.from({ length: 30 }, (_, i) => {
                const seatNum = `WS-${String(i + 1).padStart(2, "0")}`;
                const attendee = workstationMap.get(seatNum);
                const isOccupied = attendee?.check_in_status === "checked_in";
                const isSelected = selectedSeat === seatNum;

                return (
                  <button
                    key={seatNum}
                    type="button"
                    onClick={() => setSelectedSeat(isSelected ? null : seatNum)}
                    className={`h-11 border p-1 flex flex-col justify-between text-left transition-all cursor-pointer ${
                      isOccupied
                        ? "bg-lime-400/15 border-lime-400/50 text-lime-300 hover:border-lime-400"
                        : "bg-black/60 border-white/10 text-zinc-500 hover:border-white/30"
                    } ${isSelected ? "ring-2 ring-cyan-400" : ""}`}
                    title={
                      isOccupied
                        ? `${seatNum}: ${attendee?.member_name || attendee?.handle} (Admitted)`
                        : `${seatNum}: Reserved for finalist`
                    }
                  >
                    <span className="text-[9px] font-bold tracking-tight block">{seatNum}</span>
                    <span className="text-[9px] truncate block font-sans">
                      {isOccupied ? (
                        <span className="text-lime-400 font-bold font-mono">
                          @{attendee?.handle?.slice(0, 5) || "CADET"}
                        </span>
                      ) : (
                        <span className="text-zinc-600">VACANT</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Seat Inspector Banner */}
            {selectedSeat && (
              <div className="p-2.5 bg-black border border-cyan-400/40 text-xs flex items-center justify-between">
                <div>
                  <span className="text-cyan-400 font-bold">{selectedSeat}: </span>
                  {workstationMap.get(selectedSeat) ? (
                    <span className="text-zinc-200">
                      {workstationMap.get(selectedSeat).member_name} (@{workstationMap.get(selectedSeat).handle}) —{" "}
                      <span className="text-lime-400">
                        {workstationMap.get(selectedSeat).check_in_status === "checked_in" ? "Admitted" : "Pass Issued"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-zinc-500">Unallocated workstation.</span>
                  )}
                </div>
                <button onClick={() => setSelectedSeat(null)} className="text-zinc-500 hover:text-white text-xs">
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Recent Scans Feed */}
          <div className="border border-white/[0.08] p-4 bg-[#111111] space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-lime-400" />
                Live Turnstile Admittance Stream
              </span>
              <span className="text-[10px] text-zinc-500 tabular-nums">
                {recentScans.length} verified
              </span>
            </div>

            {recentScans.length === 0 ? (
              <div className="py-8 text-center text-zinc-600 space-y-2">
                <QrCode className="w-6 h-6 mx-auto text-zinc-700" />
                <p className="text-xs">Awaiting optical turnstile scans.</p>
                <p className="text-[10px] text-zinc-600">Scan candidate QR code to admit.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {recentScans.map((scan, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-black/60 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 bg-lime-400/10 border border-lime-400/40 text-lime-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-zinc-200 font-bold truncate">
                          {scan.candidate_name || scan.handle || "Cadet"}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                          @{scan.handle || "cadet"} · {scan.department || "CSE"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-lime-400 bg-lime-400/10 border border-lime-400/30 px-1.5 py-0.5">
                        {scan.seat_number || "WS-OK"}
                      </span>
                      <div className="text-[9px] text-zinc-500 tabular-nums mt-0.5">
                        {scan.time || "Just now"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. CADET CLEARANCE & ADMISSION REVIEW MODAL ────────────────────── */}
      {pendingCadet && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d0d12] border-2 border-lime-400 shadow-[0_0_40px_rgba(204,255,0,0.25)] p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-lime-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Cadet Clearance Inspection
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-white/10 px-2 py-0.5">
                HOTKEY: [A] ADMIT · [R] REJECT
              </span>
            </div>

            {/* Candidate Dossier */}
            <div className="space-y-3 bg-black border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-white">{pendingCadet.candidateName}</h4>
                  <p className="text-xs text-lime-400 font-mono">@{pendingCadet.handle}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-500 block">Assigned Workstation:</span>
                  <span className="text-xl font-black text-lime-400 font-mono tracking-wider">
                    {pendingCadet.seatNumber}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-500 block text-[10px]">DEPARTMENT:</span>
                  <span className="text-zinc-300 font-sans">{pendingCadet.department}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">ENROLLMENT / BATCH:</span>
                  <span className="text-zinc-300 font-mono">
                    {pendingCadet.enrollmentNumber || pendingCadet.batch || "2024-2028"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">PHASE 1 QUALIFYING RANK:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    Rank #{pendingCadet.rank} ({pendingCadet.screeningScore} pts)
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">PASS CODE:</span>
                  <span className="text-zinc-300 font-mono">{pendingCadet.passCode}</span>
                </div>
              </div>

              {pendingCadet.checkInStatus === "checked_in" && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Warning: Pass already checked in earlier
                    {pendingCadet.checkedInAt ? ` at ${new Date(pendingCadet.checkedInAt).toLocaleTimeString()}` : ""}.
                  </span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                onClick={handleApprove}
                disabled={isActionPending}
                className="h-12 bg-lime-400 hover:bg-lime-300 text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(204,255,0,0.35)] cursor-pointer"
              >
                <Check className="w-4 h-4 mr-2 stroke-[3]" />
                Admit Cadet [A]
              </Button>

              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isActionPending}
                className="h-12 border-rose-500/50 bg-zinc-950 text-rose-300 hover:bg-rose-500/20 font-bold text-sm uppercase tracking-wider cursor-pointer"
              >
                <XCircle className="w-4 h-4 mr-2 text-rose-400" />
                Deny Entry [Esc]
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
