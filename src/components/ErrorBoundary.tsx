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
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-black text-white font-mono selection:bg-[var(--accent)] selection:text-black">
          <div className="max-w-2xl w-full border border-rose-900/60 bg-[#0c0c0c] p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-start justify-between gap-4 border-b border-[#292929] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 border border-rose-800/80 bg-rose-950/40 text-rose-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-rose-400 block">
                    RUNTIME SECURITY TRAP • ERROR BOUNDARY
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold font-mono uppercase text-white tracking-tight">
                    {this.props.fallbackTitle || "Execution Circuit Interrupted"}
                  </h2>
                </div>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5">
                500-CLI-CRASH
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-neutral-300 font-mono leading-relaxed">
                An unexpected component rendering state was isolated by the CCC integrity watchdog. 
                Your session and cryptographic contest seals remain intact.
              </p>

              {this.state.error && (
                <div className="p-3 bg-black border border-neutral-800 font-mono text-xs text-rose-300 overflow-x-auto max-h-40">
                  <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] pb-1 border-b border-neutral-900 uppercase">
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
                className="bg-[var(--accent)] text-black hover:bg-[var(--accent)]/90 font-mono text-xs uppercase font-bold rounded-none h-auto px-4 py-2 cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                <span>Reload Interface</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = "/portal";
                }}
                className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-mono text-xs uppercase font-bold rounded-none h-auto px-4 py-2 cursor-pointer flex items-center gap-1.5"
              >
                <Home size={13} />
                <span>Return to Portal</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={this.handleCopyDiagnostic}
                className="border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white font-mono text-xs uppercase rounded-none h-auto px-3 py-2 cursor-pointer flex items-center gap-1.5 ml-auto"
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
