import { SocialDrawer } from "./SocialDrawer";
import { fetchMyFollowingIdsThunk } from "@/store/slices/socialSlice";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleSidebar, setSidebarOpen } from "@/store/slices/uiSlice";
import { logout, fetchCurrentUserThunk } from "@/store/slices/authSlice";
import { getToken, decodeJwtPayload } from "@/lib/auth";
import { formatFullName, resolveAvatarUrl } from "@/lib/utils";

const links = [
  { to: "/portal", label: "Operations", icon: LayoutDashboard, exact: true },
  { to: "/portal/contests", label: "Contests", icon: Trophy, exact: false },
  { to: "/portal/leaderboard", label: "Leaderboard", icon: Trophy, exact: true },
  { to: "/portal/problems", label: "Archive", icon: Archive, exact: false },
  { to: "/portal/profile", label: "Profile", icon: UserRound, exact: true },
  { to: "/portal/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function PortalShell() {
  const [, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((state) => state.ui.sidebarOpen);
  const { member, pending } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/auth");
      return;
    }
    dispatch(fetchMyFollowingIdsThunk());
    // Always refresh profile from server on mount to sync any updates
    dispatch(fetchCurrentUserThunk());
  }, [dispatch, navigate]);

  const token = getToken();
  const tokenPayload = token ? decodeJwtPayload(token) : null;
  const fallbackHandle = tokenPayload?.handle || (tokenPayload?.email ? tokenPayload.email.split("@")[0] : "Cadet");
  const displayHandle = member?.handle || fallbackHandle;
  const formattedName = formatFullName(member?.full_name);
  const initials = formattedName
    ? formattedName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (displayHandle.slice(0, 2) || "CC").toUpperCase();
  const resolvedAvatar = resolveAvatarUrl(member?.avatar_url);

  const cleanPath = pathname.replace(/\/+$/, "") || "/portal";
  const isFullscreenWorkspace = cleanPath.includes("/assessment") || cleanPath.includes("/arena");

  if (isFullscreenWorkspace) {
    return (
      <main className="min-h-screen bg-zinc-950 text-slate-100">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col md:flex-row antialiased selection:bg-lime-400 selection:text-black">
      {/* Mobile Topbar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40">
        <Link to="/portal" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="CCC Logo" className="w-7 h-7 object-contain" />
          <span className="font-mono font-bold text-xs tracking-wider text-white">CCC / MCU</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-300 hover:text-white hover:bg-zinc-800"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle navigation"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => dispatch(setSidebarOpen(false))}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-zinc-950 border-r border-white/10 p-5 flex flex-col z-50 transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <Link
          to="/portal"
          className="flex items-center gap-3 pb-5 mb-3 border-b border-white/10 group"
          onClick={() => dispatch(setSidebarOpen(false))}
        >
          <img
            src="/logo.png"
            alt="Chaos Computer Club Medi-Caps"
            className="w-9 h-9 object-contain group-hover:scale-105 transition-transform duration-150"
          />
          <div className="flex flex-col">
            <strong className="font-mono text-xs font-bold tracking-wider text-white">CHAOS COMPUTER CLUB</strong>
            <span className="font-mono text-[9px] font-medium text-slate-400 tracking-wider">MEDI-CAPS CHAPTER</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav aria-label="Portal navigation" className="flex flex-col gap-1 my-2">
          {links.map((item) => {
            const active = item.exact
              ? cleanPath === item.to
              : cleanPath === item.to || cleanPath.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => dispatch(setSidebarOpen(false))}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-none text-xs font-mono uppercase tracking-wider transition-colors duration-150 ${
                  active
                    ? "bg-lime-400/12 text-lime-400 border border-lime-400/25 font-bold shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-zinc-900 border border-transparent font-medium"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 text-lime-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Offline Mission Banner */}
        <div className="mt-auto mb-4 p-3.5 rounded-none border border-white/8 bg-zinc-900/50 backdrop-blur-xs">
          <span className="block font-mono text-[10px] font-bold text-lime-400 tracking-wider uppercase">
            Offline By Design
          </span>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            No remote submissions. Every official result is verified at a physical Medi-Caps workstation.
          </p>
        </div>

        {/* User Card */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <Link
            to="/portal/profile"
            className="flex items-center gap-2.5 min-w-0 group hover:opacity-95 transition-opacity"
            title="View Cadet Profile Dossier"
          >
            <Avatar className="w-8 h-8 rounded-none border border-white/15 bg-zinc-900 text-lime-400 shrink-0 group-hover:border-lime-400/50 transition-colors">
              {resolvedAvatar ? (
                <AvatarImage src={resolvedAvatar} alt={formattedName || displayHandle} className="object-cover" />
              ) : null}
              <AvatarFallback className="rounded-none bg-lime-400/10 text-lime-400 font-mono font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <strong className="block font-mono text-xs font-semibold text-white truncate group-hover:text-lime-400 transition-colors">
                {formattedName || displayHandle}
              </strong>
              <span className="block font-mono text-[10px] text-slate-400 truncate tabular-nums">
                {member?.handle ? `@${member.handle}` : `@${displayHandle}`} · {member ? `${member.rating} · ${member.department ?? "Member"}` : "Verified Member"}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => dispatch(logout())}
            aria-label="Sign out"
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-none hover:bg-zinc-900 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 md:ml-64 min-h-screen bg-zinc-950 p-4 md:p-8 relative">
        <Outlet />
      </main>

      <SocialDrawer />
    </div>
  );
}
