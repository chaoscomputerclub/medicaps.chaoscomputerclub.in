import { useState } from "react";
import { Radio, Plus, Send, CheckCircle2, ShieldCheck, Terminal, Layers, ArrowUpRight } from "lucide-react";
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
      {/* Left: Webhook Registry & Documentation */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <CardTitle className="font-mono text-xs uppercase text-white font-bold">
                Register Outbound Webhook Listener
              </CardTitle>
            </div>
            <CardDescription className="text-[11px] text-zinc-500 font-mono">
              The platform will POST JSON payloads to registered endpoints on every state transition.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <form onSubmit={handleRegisterWebhook} className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase text-zinc-400 mb-1.5">
                  External Listener URL:
                </label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-server.edu/api/gate-events"
                    className="h-9 bg-black border-zinc-800 text-xs font-mono text-white placeholder:text-zinc-600 rounded-none"
                  />
                  <Button
                    type="submit"
                    disabled={isRegistering || !webhookUrl.trim()}
                    className="h-9 bg-cyan-600 hover:bg-cyan-500 text-black font-mono text-xs uppercase font-bold rounded-none px-3"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Register
                  </Button>
                </div>
              </div>
            </form>

            <div className="pt-2">
              <span className="text-[11px] text-zinc-400 block mb-2 uppercase">Registered Webhook Sinks:</span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {registeredList.map((url, i) => (
                  <div key={i} className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-sm flex items-center justify-between text-[11px] text-zinc-300">
                    <span className="truncate pr-2">{url}</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] font-mono flex-shrink-0">
                      ACTIVE
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-sm text-[11px] text-zinc-400 space-y-1">
              <span className="text-white font-bold block">OpenAPI 3.1.0 Webhook Events:</span>
              <div>• <code className="text-red-400">pass-checked-in</code>: Gate pass validation</div>
              <div>• <code className="text-cyan-400">contest-status-changed</code>: Lifecycle change</div>
              <div>• <code className="text-amber-400">top30-qualified</code>: Finalist selection</div>
              <div>• <code className="text-emerald-400">submission-evaluated</code>: CodeBox execution</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Live Realtime Event Stream Stream Log */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <CardTitle className="font-mono text-xs uppercase text-white font-bold">
                  Real-Time Event Stream Log ({eventsLog.length})
                </CardTitle>
              </div>
              <span className="text-[10px] text-zinc-500">Live SSE Activity</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 max-h-[480px] overflow-y-auto space-y-2">
            {eventsLog.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-600">
                Awaiting real-time webhook & SSE broadcast events...
              </div>
            ) : (
              eventsLog.map((ev, idx) => (
                <div key={idx} className="p-3 bg-black/60 border border-zinc-800 rounded-sm font-mono text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-red-400 font-bold uppercase">{ev.event}</span>
                    <span className="text-zinc-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <pre className="text-[11px] text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-900 overflow-x-auto">
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
