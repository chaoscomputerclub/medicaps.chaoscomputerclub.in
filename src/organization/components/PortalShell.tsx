import { EditProfileModal } from "./EditProfileModal";
import { SocialDrawer } from "./SocialDrawer";
import { fetchMyFollowingIdsThunk } from "@/store/slices/socialSlice";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  History,
  Award,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
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

const links = [
  { to: "/portal", label: "Operations", icon: LayoutDashboard, exact: true },
  { to: "/portal/contests", label: "Contests", icon: Trophy, exact: false },
  { to: "/portal/leaderboard", label: "Leaderboard", icon: Award, exact: true },
  { to: "/portal/problems", label: "Archive", icon: Archive, exact: false },
  { to: "/portal/profile", label: "Profile", icon: UserRound, exact: true },
  { to: "/portal/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function PortalShell() {
  const [hydrated, setHydrated] = useState(false);
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
    if (!member && !pending) {
      dispatch(fetchCurrentUserThunk());
      dispatch(fetchMyFollowingIdsThunk());
    }
  }, [dispatch, member, pending, navigate]);

  const token = getToken();
  const tokenPayload = token ? decodeJwtPayload(token) : null;
  const fallbackHandle = tokenPayload?.handle || (tokenPayload?.email ? tokenPayload.email.split("@")[0] : "Cadet");
  const displayHandle = member?.handle || fallbackHandle;
  const initials = member?.full_name
    ? member.full_name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (displayHandle.slice(0, 2) || "CC").toUpperCase();

  const cleanPath = pathname.replace(/\/+$/, "") || "/portal";
  const isFullscreenWorkspace = cleanPath.includes("/assessment") || cleanPath.includes("/arena");

  if (isFullscreenWorkspace) {
    return (
      <main className="portal-main-assessment">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="portal-frame">
      <header className="mobile-topbar">
        <Link to="/portal" className="brand-lockup">
          <img src="/logo.png" alt="Chaos Computer Club Medi-Caps" />
          <span>CCC / MCU</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle navigation"
        >
          {open ? <X /> : <Menu />}
        </Button>
      </header>

      <aside className={open ? "portal-sidebar open" : "portal-sidebar"}>
        <Link to="/portal" className="brand-lockup" onClick={() => dispatch(setSidebarOpen(false))}>
          <img src="/logo.png" alt="Chaos Computer Club Medi-Caps" />
          <div>
            <strong>CHAOS COMPUTER CLUB</strong>
            <span>MEDI-CAPS CHAPTER</span>
          </div>
        </Link>

        <nav aria-label="Portal navigation">
          {links.map((item) => {
            const active = item.exact
              ? cleanPath === item.to
              : cleanPath === item.to || cleanPath.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? "nav-item active" : "nav-item"}
                onClick={() => dispatch(setSidebarOpen(false))}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
                {active && <ChevronRight size={14} />}
              </Link>
            );
          })}
        </nav>

        <div className="offline-manifest">
          <span>OFFLINE BY DESIGN</span>
          <p>No browser submissions. Every result begins at a proctored Medi-Caps workstation.</p>
        </div>

        <div className="sidebar-user">
          <Avatar className="w-8 h-8 rounded-[1px] border border-[var(--line)] bg-[var(--accent)] text-[var(--accent-ink)] flex-shrink-0">
            {member?.avatar_url && (member.avatar_url.startsWith("http") || member.avatar_url.startsWith("/media/")) ? (
              <AvatarImage src={member.avatar_url || undefined} alt={member.handle || "avatar"} className="object-cover" />
            ) : null}
            <AvatarFallback className="rounded-[1px] bg-[var(--accent)] text-[var(--accent-ink)] font-mono font-bold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <strong>{displayHandle}</strong>
            <span>{member ? `${member.rating} · ${member.department ?? "Member"}` : "Verified Member"}</span>
          </div>
          <button
            type="button"
            onClick={() => dispatch(logout())}
            aria-label="Sign out"
            style={{ background: "none", border: 0, color: "var(--muted)", cursor: "pointer" }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="portal-main">
        <Outlet />
      </main>
      <SocialDrawer />
      <EditProfileModal />
    </div>
  );
}
