import { useState, useMemo } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Download,
  Zap,
  RefreshCw,
  MonitorCheck,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
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
    const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    return { total, checkedIn, pending, rate };
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
        toast.success(
          `Manually admitted ${attendee.member_name || attendee.handle} to workstation ${
            res.seat_number || attendee.seat_number
          }`
        );
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
    const headers = [
      "Seat Number",
      "Pass Code",
      "Full Name",
      "Handle",
      "Enrollment Number",
      "Department",
      "Status",
      "Checked In At",
    ];
    const rows = attendees.map((a) => [
      a.seat_number || "N/A",
      a.pass_code || "N/A",
      `"${a.member_name || a.full_name || ""}"`,
      a.handle || "",
      a.enrollment_number || "N/A",
      a.department || "CSE",
      a.check_in_status || "issued",
      a.checked_in_at || "N/A",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ccc_${selectedContestSlug}_attendee_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Attendee roster exported to CSV.");
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Main Roster Card */}
      <Card className="admin-card bg-[#09090d] border border-white/10 rounded-none">
        <CardHeader className="border-b border-white/10 py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-none cursor-pointer transition-colors ${
                  filter === "all"
                    ? "bg-lime-400 text-black"
                    : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/10"
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilter("checked_in")}
                className={`px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-none cursor-pointer transition-colors ${
                  filter === "checked_in"
                    ? "bg-lime-400 text-black"
                    : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/10"
                }`}
              >
                Admitted ({stats.checkedIn})
              </button>
              <button
                type="button"
                onClick={() => setFilter("issued")}
                className={`px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-none cursor-pointer transition-colors ${
                  filter === "issued"
                    ? "bg-lime-400 text-black"
                    : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/10"
                }`}
              >
                Pending ({stats.pending})
              </button>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cadets..."
                  className="pl-8 bg-black border-white/15 text-xs font-mono text-white rounded-none h-8 w-44 sm:w-60 focus-visible:ring-2 focus-visible:ring-lime-400"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-8 px-2.5 border-white/15 bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-none"
              >
                <Download className="w-3.5 h-3.5 sm:mr-1 text-lime-400" />
                <span className="hidden sm:inline">CSV</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 px-2.5 border-white/15 bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-none"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 sm:mr-1 text-lime-400 ${
                    isLoading ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">Sync</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-black font-mono text-xs border-b border-white/10">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                  Workstation
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                  Cadet Dossier
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                  Pass Code
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                  Gate Clearance
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px] text-right">
                  Proctor Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs divide-y divide-white/5">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-zinc-400 font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-lime-400" />
                      <span>Reading encrypted cadet manifests...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAttendees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-zinc-400 font-mono">
                    No cadets matched the active filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendees.map((a, idx) => {
                  const isCheckedIn = a.check_in_status === "checked_in";
                  return (
                    <TableRow
                      key={a.id || a.pass_code || idx}
                      className="border-white/5 hover:bg-zinc-900/50 transition-colors"
                    >
                      {/* Workstation Seat */}
                      <TableCell className="font-bold py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`px-2 py-1 text-xs font-mono font-extrabold tracking-wider border rounded-none ${
                              isCheckedIn
                                ? "bg-lime-400/10 border-lime-400/30 text-lime-400"
                                : "bg-zinc-900/80 border-white/10 text-zinc-400"
                            }`}
                          >
                            {a.seat_number || "UNASSIGNED"}
                          </div>
                        </div>
                      </TableCell>

                      {/* Cadet Identity */}
                      <TableCell className="py-3.5">
                        <div className="text-white font-bold tracking-wide">
                          {a.member_name || a.full_name || a.handle}
                        </div>
                        <div className="text-zinc-400 text-[11px] flex items-center gap-2 mt-0.5">
                          <span className="text-lime-400/80">@{a.handle}</span>
                          <span>•</span>
                          <span>{a.department || "CSE"}</span>
                          {a.enrollment_number && (
                            <>
                              <span>•</span>
                              <span className="text-zinc-400">{a.enrollment_number}</span>
                            </>
                          )}
                        </div>
                      </TableCell>

                      {/* Pass Code */}
                      <TableCell className="text-zinc-400 text-[11px] font-mono py-3.5">
                        <span className="px-2 py-0.5 bg-black border border-white/10 text-zinc-300 select-all">
                          {a.pass_code || "—"}
                        </span>
                      </TableCell>

                      {/* Gate Status Badge */}
                      <TableCell className="py-3.5">
                        {isCheckedIn ? (
                          <Badge className="bg-lime-400/10 text-lime-400 border-lime-400/30 text-[10px] font-mono font-bold uppercase rounded-none tracking-wider px-2 py-0.5">
                            ADMITTED
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-400/10 text-amber-400 border-amber-400/30 text-[10px] font-mono font-bold uppercase rounded-none tracking-wider px-2 py-0.5"
                          >
                            AWAITING SCAN
                          </Badge>
                        )}
                      </TableCell>

                      {/* Proctor Action / Timestamp */}
                      <TableCell className="text-right py-3.5">
                        {!isCheckedIn ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={checkingInId === (a.pass_code || a.id)}
                            onClick={() => handleManualCheckIn(a)}
                            className="h-8 text-xs font-mono font-bold uppercase tracking-wider bg-zinc-900 border-white/15 text-zinc-300 hover:text-black hover:bg-lime-400 hover:border-lime-400 rounded-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
                          >
                            <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" />
                            Admit
                          </Button>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] text-lime-400 font-mono font-bold tabular-nums">
                              {a.checked_in_at
                                ? new Date(a.checked_in_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })
                                : "Admitted"}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono uppercase">
                              Verified IST
                            </span>
                          </div>
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
