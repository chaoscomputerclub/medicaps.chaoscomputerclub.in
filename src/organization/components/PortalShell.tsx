import { EditProfileModal } from './EditProfileModal';
import { SocialDrawer } from './SocialDrawer';
import { fetchMyFollowingIdsThunk } from '@/store/slices/socialSlice';
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  Award,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleSidebar, setSidebarOpen } from "@/store/slices/uiSlice";
import { logout, fetchCurrentUserThunk } from "@/store/slices/authSlice";
import { getToken } from "@/lib/auth";

const links = [
  { to: "/portal", label: "Operations", icon: LayoutDashboard, exact: true },
  { to: "/portal/contests", label: "Contests", icon: Trophy, exact: false },
  { to: "/portal/leaderboard", label: "Leaderboard", icon: Award, exact: true },
  { to: "/portal/problems", label: "Archive", icon: Archive, exact: false },
  { to: "/portal/verify", label: "Verify proof", icon: ShieldCheck, exact: true },
  { to: "/portal/profile", label: "Profile", icon: UserRound, exact: true },
] as const;

export function PortalShell() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.sidebarOpen);
  const member = useAppSelector((state) => state.auth.member);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!member) {
      dispatch(fetchCurrentUserThunk());
      dispatch(fetchMyFollowingIdsThunk());
    }
  }, [dispatch, member]);

  const initials = member?.handle
    ? member.handle.slice(0, 2).toUpperCase()
    : member?.full_name
    ? member.full_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const cleanPath = pathname.replace(/\/+$/, "") || "/portal";

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
        <Link
          to="/portal"
          className="brand-lockup"
          onClick={() => dispatch(setSidebarOpen(false))}
        >
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
                preload="intent"
                activeOptions={{ exact: item.exact }}
                activeProps={{ className: "active" }}
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
          <p>
            No browser submissions. Every result begins at a proctored
            Medi-Caps workstation.
          </p>
        </div>

        <div className="sidebar-user">
          <div className="avatar-code">{initials}</div>
          <div>
            <strong>{member?.handle ?? (typeof window !== "undefined" && !getToken() ? "Sign in required" : "Loading…")}</strong>
            <span>
              {member ? `${member.rating} · ${member.department ?? "Member"}` : ""}
            </span>
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
