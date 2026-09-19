import { useState } from "react";
import {
  Radio,
  Plus,
  Send,
  CheckCircle2,
  ShieldCheck,
  Terminal,
  Layers,
  ArrowUpRight,
  Activity,
  Globe,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getApiBase, getToken } from "@/lib/auth";

interface WebhooksMonitorPanelProps {
  eventsLog: any[];
}

export function WebhooksMonitorPanel({ eventsLog }: WebhooksMonitorPanelProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredList, setRegisteredList] = useState<string[]>([
    "https://api.chaoscomputerclub.in/webhooks/gate-monitor",
  ]);

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || !webhookUrl.startsWith("http")) {
      toast.error("Please enter a valid HTTP/HTTPS webhook listener URL.");
      return;
    }

    setIsRegistering(true);
    try {
      const base = getApiBase();
      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${base}/webhooks/register-outbound`, {
        method: "POST",
        headers,
        body: JSON.stringify({ webhook_url: webhookUrl.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to register webhook URL with server.");
      }

      const data = await res.json();
      setRegisteredList((prev) => Array.from(new Set([...prev, webhookUrl.trim()])));
      setWebhookUrl("");
      toast.success(data.message || "Webhook listener URL registered successfully.");
    } catch (err: any) {
      toast.error(err.message || "Error registering webhook.");
    } finally {
      setIsRegistering(false);
    }
  };

  const getEventBadgeColor = (eventType: string) => {
    const ev = (eventType || "").toLowerCase();
    if (ev.includes("pass") || ev.includes("gate") || ev.includes("check")) {
      return "text-lime-400 bg-lime-400/10 border-lime-400/30";
    }
    if (ev.includes("contest") || ev.includes("status")) {
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/30";
    }
    if (ev.includes("top30") || ev.includes("qualif")) {
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    }
    return "text-zinc-300 bg-zinc-900 border-white/10";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
      {/* Left: Webhook Registry & Documentation */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-2xl">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                <Radio className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                Outbound Webhook Dispatcher
              </CardTitle>
            </div>
            <CardDescription className="text-[11px] text-zinc-400 font-mono">
              The CCC server broadcasts real-time JSON payloads to registered endpoints.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <form onSubmit={handleRegisterWebhook} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
                  External Listener URL:
                </label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://lab-screen.medicaps.ac.in/api/events"
                    className="h-10 bg-black border-white/15 text-base sm:text-xs font-mono text-white placeholder:text-zinc-600 rounded-none focus-visible:ring-2 focus-visible:ring-lime-400"
                  />
                  <Button
                    type="submit"
                    disabled={isRegistering || !webhookUrl.trim()}
                    className="h-10 bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-extrabold tracking-wider rounded-none px-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Register
                  </Button>
                </div>
              </div>
            </form>

            <div className="pt-2">
              <span className="text-[10px] text-zinc-400 block mb-2 uppercase font-bold tracking-widest">
                Active Webhook Sinks ({registeredList.length})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {registeredList.map((url, i) => (
                  <div
                    key={i}
                    className="p-2 bg-black border border-white/10 rounded-none flex items-center justify-between text-[11px] text-zinc-300 hover:border-lime-400/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Globe className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="truncate font-mono">{url}</span>
                    </div>
                    <Badge className="bg-lime-400/10 text-lime-400 border-lime-400/30 text-[9px] font-mono font-bold uppercase rounded-none tracking-wider flex-shrink-0">
                      ONLINE
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-black border border-white/10 rounded-none text-[11px] text-zinc-400 space-y-2">
              <div className="flex items-center gap-1.5 text-white font-bold uppercase text-[10px] tracking-wider">
                <Code2 className="w-3.5 h-3.5 text-lime-400" />
                <span>OpenAPI 3.1.0 Event Catalog</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <code className="text-lime-400 bg-zinc-900 px-1 py-0.5 border border-lime-400/20">
                    pass_checked_in
                  </code>
                  <span className="text-zinc-400">— Gate barcode scan & seat admit</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-cyan-400 bg-zinc-900 px-1 py-0.5 border border-cyan-400/20">
                    contest_status_changed
                  </code>
                  <span className="text-zinc-400">— Live arena phase transitions</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-amber-400 bg-zinc-900 px-1 py-0.5 border border-amber-400/20">
                    top30_qualified
                  </code>
                  <span className="text-zinc-400">— Screening evaluation & pass generation</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Live Real-Time Event Stream Log */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-2xl">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-none bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                  <Terminal className="w-3.5 h-3.5" />
                </div>
                <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                  Real-Time Event Stream Waterfall ({eventsLog.length})
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-lime-400">
                <span className="w-2 h-2 rounded-none bg-lime-400 animate-pulse" />
                <span className="font-bold tracking-wider uppercase">SSE Listening</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 max-h-[520px] overflow-y-auto space-y-2">
            {eventsLog.length === 0 ? (
              <div className="py-20 text-center text-xs text-zinc-600 space-y-2 font-mono">
                <Activity className="w-6 h-6 mx-auto text-zinc-700 animate-pulse" />
                <p>Awaiting real-time webhook & SSE broadcast events...</p>
                <p className="text-[10px] text-zinc-700">
                  Trigger gate check-ins or contest lifecycle switches to view live telemetry.
                </p>
              </div>
            ) : (
              eventsLog.map((ev, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-black border border-white/10 rounded-none font-mono text-xs space-y-2 hover:border-lime-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] border rounded-none ${getEventBadgeColor(
                        ev.event
                      )}`}
                    >
                      {ev.event}
                    </span>
                    <span className="text-zinc-500 tabular-nums">
                      {new Date(ev.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                      IST
                    </span>
                  </div>
                  <pre className="text-[11px] text-zinc-300 bg-zinc-950 p-2.5 rounded-none border border-white/5 overflow-x-auto leading-relaxed">
                    {JSON.stringify(ev.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
