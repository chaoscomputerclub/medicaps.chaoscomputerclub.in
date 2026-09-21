import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Terminal, Home, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[CCC Boundary Caught Error]:", error, errorInfo);

    // Auto-recover from stale dynamic chunk imports (e.g. following dev rebuild or production deployment)
    const isChunkError =
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Importing a module script failed") ||
      error.name === "ChunkLoadError";

    if (isChunkError) {
      const lastAutoReload = sessionStorage.getItem("ccc_last_chunk_autoreload");
      const now = Date.now();
      if (!lastAutoReload || now - parseInt(lastAutoReload, 10) > 10000) {
        sessionStorage.setItem("ccc_last_chunk_autoreload", String(now));
        window.location.reload();
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    window.location.reload();
  };

  private handleCopyDiagnostic = () => {
    const diagnostic = `CCC CLIENT RUNTIME EXCEPTION REPORT
Time: ${new Date().toISOString()}
Location: ${window.location.href}
Error: ${this.state.error?.message || "Unknown error"}
Stack:
${this.state.error?.stack || "No stack trace available"}
Component Stack:
${this.state.errorInfo?.componentStack || "No component stack available"}`;

    navigator.clipboard.writeText(diagnostic);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  public render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Importing a module script failed") ||
        this.state.error?.name === "ChunkLoadError";

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-zinc-950 text-white font-mono selection:bg-lime-400 selection:text-black">
          <div className="max-w-2xl w-full border border-rose-500/30 bg-zinc-900/80 backdrop-blur-md p-6 sm:p-8 space-y-6 shadow-2xl rounded-none relative">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-none border border-rose-500/30 bg-rose-950/40 text-rose-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-rose-400 block">
                    {isChunkError ? "APPLICATION UPDATE • STALE CHUNK" : "RUNTIME SECURITY TRAP • ERROR BOUNDARY"}
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold font-mono uppercase text-white tracking-tight">
                    {isChunkError ? "Module Updated — Sync Required" : (this.props.fallbackTitle || "Execution Circuit Interrupted")}
                  </h2>
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-white/10 px-2.5 py-1 rounded-none">
                {isChunkError ? "CHUNK-REFRESH" : "500-CLI-CRASH"}
              </span>
            </div>


            <div className="space-y-2">
              <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                An unexpected component rendering state was isolated by the CCC integrity watchdog. 
                Your session and cryptographic contest seals remain intact.
              </p>

              {this.state.error && (
                <div className="p-3.5 bg-zinc-950/90 border border-white/10 rounded-none font-mono text-xs text-rose-300 overflow-x-auto max-h-40">
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] pb-1 border-b border-white/5 uppercase">
                    <Terminal size={12} />
                    <span>Exception Message</span>
                  </div>
                  <pre className="pt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={this.handleReset}
                className="bg-lime-400 text-black hover:bg-lime-400 font-mono text-xs uppercase font-bold rounded-none h-10 px-4 cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={13} />
                <span>Reload Interface</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="border-white/10 bg-zinc-900/70 hover:bg-zinc-800 hover:text-white text-zinc-200 font-mono text-xs uppercase font-bold rounded-none h-10 px-4 cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Home size={13} />
                <span>Return to Arena</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={this.handleCopyDiagnostic}
                className="border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white font-mono text-xs uppercase rounded-none h-10 px-3 cursor-pointer flex items-center gap-1.5 ml-auto transition-colors"
              >
                {this.state.copied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">Diagnostic Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy Diagnostic</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
