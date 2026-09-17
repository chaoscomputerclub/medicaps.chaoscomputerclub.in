import { useState, useMemo } from "react";
import { Users, Search, CheckCircle2, Clock, MapPin, UserCheck, Download, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { triggerWebhookGateScan } from "@/lib/realtime";

interface AttendeesPanelProps {
  attendees: any[];
  isLoading: boolean;
  selectedContestSlug: string;
  proctorName: string;
  onRefresh: () => void;
}

export function AttendeesPanel({
  attendees,
  isLoading,
  selectedContestSlug,
  proctorName,
  onRefresh,
}: AttendeesPanelProps) {
  const [filter, setFilter] = useState<"all" | "checked_in" | "issued">("all");
  const [search, setSearch] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = attendees.length;
    const checkedIn = attendees.filter((a) => a.check_in_status === "checked_in").length;
    const pending = total - checkedIn;
    return { total, checkedIn, pending };
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    return attendees.filter((a) => {
      // Filter tab
      if (filter === "checked_in" && a.check_in_status !== "checked_in") return false;
      if (filter === "issued" && a.check_in_status === "checked_in") return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (a.member_name || a.full_name || "").toLowerCase().includes(q);
        const matchHandle = (a.handle || "").toLowerCase().includes(q);
        const matchSeat = (a.seat_number || "").toLowerCase().includes(q);
        const matchPass = (a.pass_code || "").toLowerCase().includes(q);
        const matchEnroll = (a.enrollment_number || "").toLowerCase().includes(q);
        if (!matchName && !matchHandle && !matchSeat && !matchPass && !matchEnroll) return false;
      }
      return true;
    });
  }, [attendees, filter, search]);

  const handleManualCheckIn = async (attendee: any) => {
    setCheckingInId(attendee.pass_code || attendee.id);
    try {
      const res = await triggerWebhookGateScan(
        attendee.pass_code || attendee.qr_data || attendee.handle,
        proctorName,
        selectedContestSlug
      );
      if (res.valid) {
        toast.success(`Manually admitted ${attendee.member_name || attendee.handle} to seat ${res.seat_number || attendee.seat_number}`);
        onRefresh();
      } else {
        toast.error(`Check-in failed: ${res.reason || "Invalid pass"}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Manual check-in error.");
    } finally {
      setCheckingInId(null);
    }
  };

  const handleExportCsv = () => {
    if (attendees.length === 0) {
      toast.error("No attendees to export.");
      return;
    }
    const headers = ["Seat Number", "Pass Code", "Name", "Handle", "Department", "Status", "Checked In At"];
    const rows = attendees.map((a) => [
      a.seat_number || "N/A",
      a.pass_code || "N/A",
      `"${a.member_name || a.full_name || ""}"`,
      a.handle || "",
      a.department || "CSE",
      a.check_in_status || "issued",
      a.checked_in_at || "N/A",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ccc_${selectedContestSlug}_attendees.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Attendee roster exported to CSV.");
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#0c0c0c] border border-white/10 rounded-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-zinc-400 uppercase">Total Qualified Cadets</span>
            <Users className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-white mt-1">{stats.total}</div>
          <span className="text-[11px] font-mono text-zinc-500">Allocated physical seats</span>
        </div>

        <div className="p-4 bg-[#0c0c0c] border border-emerald-500/30 rounded-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-emerald-400 uppercase">Checked In / Admitted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">{stats.checkedIn}</div>
          <span className="text-[11px] font-mono text-emerald-500/70">
            {stats.total > 0 ? `${Math.round((stats.checkedIn / stats.total) * 100)}% attendance` : "0% attendance"}
          </span>
        </div>

        <div className="p-4 bg-[#0c0c0c] border border-amber-500/30 rounded-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-amber-400 uppercase">Pending Gate Entry</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-400 mt-1">{stats.pending}</div>
          <span className="text-[11px] font-mono text-amber-500/70">Awaiting QR scan at gate</span>
        </div>
      </div>

      {/* Roster Table Card */}
      <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-400" />
              <CardTitle className="font-mono text-sm tracking-wide uppercase text-white font-bold">
                Workstation Allocation & Attendee Roster
              </CardTitle>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-8 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 font-mono text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 font-mono text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, handle, seat or pass..."
                className="pl-9 bg-black border-zinc-800 text-xs font-mono text-white placeholder:text-zinc-600 rounded-none h-9"
              />
            </div>

            <div className="flex items-center gap-1 w-full sm:w-auto bg-zinc-900 p-1 rounded-sm border border-zinc-800">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1 text-xs font-mono rounded-none ${
                  filter === "all" ? "bg-red-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilter("checked_in")}
                className={`px-3 py-1 text-xs font-mono rounded-none ${
                  filter === "checked_in" ? "bg-emerald-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Checked In ({stats.checkedIn})
              </button>
              <button
                type="button"
                onClick={() => setFilter("issued")}
                className={`px-3 py-1 text-xs font-mono rounded-none ${
                  filter === "issued" ? "bg-amber-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Pending ({stats.pending})
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-950/60 font-mono text-xs border-b border-zinc-800">
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 font-mono">Workstation Seat</TableHead>
                <TableHead className="text-zinc-400 font-mono">Cadet</TableHead>
                <TableHead className="text-zinc-400 font-mono">Pass Code</TableHead>
                <TableHead className="text-zinc-400 font-mono">Gate Status</TableHead>
                <TableHead className="text-zinc-400 font-mono text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-zinc-500 font-mono">
                    Loading attendee roster...
                  </TableCell>
                </TableRow>
              ) : filteredAttendees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-zinc-500 font-mono">
                    No attendees match the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendees.map((a, idx) => {
                  const isCheckedIn = a.check_in_status === "checked_in";
                  return (
                    <TableRow key={a.id || a.pass_code || idx} className="border-zinc-800 hover:bg-zinc-900/40">
                      <TableCell className="font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <MapPin className={`w-3.5 h-3.5 ${isCheckedIn ? "text-emerald-400" : "text-zinc-600"}`} />
                          <span className={isCheckedIn ? "text-emerald-300" : "text-zinc-300"}>
                            {a.seat_number || "UNASSIGNED"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-white font-medium">{a.member_name || a.full_name || a.handle}</div>
                        <div className="text-zinc-500 text-[11px]">@{a.handle} · {a.department || "CSE"}</div>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-[11px] font-mono">
                        {a.pass_code}
                      </TableCell>
                      <TableCell>
                        {isCheckedIn ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                            CHECKED IN
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-zinc-900 text-amber-400 border-amber-500/30 text-[10px] font-mono">
                            AWAITING SCAN
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isCheckedIn ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={checkingInId === (a.pass_code || a.id)}
                            onClick={() => handleManualCheckIn(a)}
                            className="h-7 text-[11px] font-mono bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-red-600 hover:border-red-600 rounded-none"
                          >
                            <Zap className="w-3 h-3 mr-1 text-amber-400" />
                            Admit
                          </Button>
                        ) : (
                          <span className="text-[11px] text-zinc-500 font-mono">
                            {a.checked_in_at ? new Date(a.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Admitted"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
