import { SocialDrawer } from "./SocialDrawer";
import { fetchMyFollowingIdsThunk, fetchMySocialStatsThunk } from "@/store/slices/socialSlice";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { prefetchRoute } from "@/AppRoutes";
import { markNavigationClick } from "@/lib/navigationTelemetry";
import {
  LayoutDashboard,
  Trophy,
  Bookmark,
  BarChart2,
  Code2,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState, useRef, Suspense } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleSidebar, setSidebarOpen } from "@/store/slices/uiSlice";
import { logout, fetchCurrentUserThunk } from "@/store/slices/authSlice";
import { getToken, clearToken, decodeJwtPayload } from "@/lib/auth";
import { formatFullName, resolveAvatarUrl } from "@/lib/utils";
import {
  ContestsHubSkeleton,
  ContestDetailSkeleton,
  ContestLobbySkeleton,
  ContestSummarySkeleton,
  ContestResultsSkeleton,
  ContestFinalResultsSkeleton,
  LeaderboardSkeleton,
  MyContestsSkeleton,
  ProblemArchiveSkeleton,
  ProblemDetailSkeleton,
  ProfileSkeleton,
  SettingsSkeleton,
  DashboardSkeleton,
  AssessmentStudioSkeleton,
} from "./skeletons";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/contests", label: "Contests", icon: Trophy, exact: false },
  { to: "/my-contests", label: "My Contests", icon: Bookmark, exact: false },
  { to: "/leaderboard", label: "Leaderboard", icon: BarChart2, exact: true },
  { to: "/problems", label: "Problems", icon: Code2, exact: false },
  { to: "/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function PortalRouteSkeleton() {
  const { pathname } = useLocation();
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  if (cleanPath === "/contests") {
    return <ContestsHubSkeleton />;
  }
  if (cleanPath.includes("/summary") || cleanPath.includes("/submit")) {
    return <ContestSummarySkeleton />;
  }
  if (cleanPath.includes("/lobby")) {
    return <ContestLobbySkeleton />;
  }
  if (cleanPath.includes("/arena") || cleanPath.includes("/problems/")) {
    return <AssessmentStudioSkeleton />;
  }
  if (cleanPath.includes("/final-results")) {
    return <ContestFinalResultsSkeleton />;
  }
  if (cleanPath.includes("/results")) {
    return <ContestResultsSkeleton />;
  }
  if (cleanPath.startsWith("/contests/")) {
    return <ContestDetailSkeleton />;
  }
  if (cleanPath.startsWith("/my-contests")) {
    return <MyContestsSkeleton />;
  }
  if (cleanPath.startsWith("/leaderboard")) {
    return <LeaderboardSkeleton />;
  }
  if (cleanPath === "/problems") {
    return <ProblemArchiveSkeleton />;
  }
  if (cleanPath.startsWith("/problems/")) {
    return <ProblemDetailSkeleton />;
  }
  if (cleanPath.startsWith("/settings")) {
    return <SettingsSkeleton />;
  }
  if (cleanPath.startsWith("/profile") || cleanPath.startsWith("/u/")) {
    return <ProfileSkeleton />;
  }
  return <DashboardSkeleton />;
}

export function PortalShell() {
  const [, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((state) => state.ui.sidebarOpen);
  const { member } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const pathname = location.pathname;

  const handleLogout = () => {
    dispatch(logout());
    clearToken();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("ccc_auth_token");
        localStorage.removeItem("ccc_member_profile");
        sessionStorage.clear();
      } catch {}
      window.location.replace("/auth");
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }
    dispatch(fetchMySocialStatsThunk());
    dispatch(fetchCurrentUserThunk());
  }, [dispatch]);

  const token = getToken();
  const tokenPayload = token ? decodeJwtPayload(token) : null;
  const fallbackHandle = tokenPayload?.["handle"] || (tokenPayload?.["email"] ? tokenPayload["email"].split("@")[0] || "Cadet" : "Cadet");
  const displayHandle = member?.handle || fallbackHandle;
  const displayEmail = member?.email || tokenPayload?.["email"] || (tokenPayload?.["sub"] && String(tokenPayload["sub"]).includes("@") ? String(tokenPayload["sub"]) : "");
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

  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  const isFullscreenWorkspace =
    cleanPath.includes("/assessment") ||
    cleanPath.includes("/arena") ||
    cleanPath.includes("/lobby") ||
    cleanPath.includes("/summary") ||
    cleanPath.includes("/submit") ||
    (cleanPath.includes("/contests/") && (
      cleanPath.includes("/problems") ||
      cleanPath.includes("/summary") ||
      cleanPath.includes("/submit")
    ));

  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{
    top: number;
    height: number;
    opacity: number;
    ready: boolean;
  }>({ top: 0, height: 36, opacity: 0, ready: false });

  // Active indicator positioning
  useEffect(() => {
    const activeItem = links.find((item) =>
      item.exact
        ? cleanPath === item.to
        : cleanPath === item.to || cleanPath.startsWith(item.to + "/")
    );

    if (!activeItem) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const activeEl = itemRefs.current[activeItem.to];
    if (activeEl) {
      setIndicatorStyle({
        top: activeEl.offsetTop,
        height: activeEl.offsetHeight || 36,
        opacity: 1,
        ready: true,
      });
    }
  }, [cleanPath, open]);

  if (isFullscreenWorkspace) {
    const isSummary = cleanPath.includes("/summary") || cleanPath.includes("/submit");
    const isLobby = cleanPath.includes("/lobby");
    const workspaceFallback = isSummary
      ? <ContestSummarySkeleton />
      : isLobby
      ? <ContestLobbySkeleton />
      : <AssessmentStudioSkeleton />;

    return (
      <main className="min-h-screen bg-black text-white">
        <Suspense fallback={workspaceFallback}>
          <Outlet />
        </Suspense>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row antialiased selection:bg-lime-400 selection:text-black w-full max-w-full overflow-x-hidden">
      {/* Mobile Topbar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] border-b border-white/8 bg-black/95 backdrop-blur-md sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src="/logo.webp" alt="Chaos Computer Club" className="w-7 h-7 object-contain transition-transform duration-150 group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="font-sans font-bold text-xs tracking-wider text-white leading-none">CCC MEDI-CAPS</span>
            <span className="font-sans text-[8px] text-zinc-400 tracking-widest mt-0.5">TOURNAMENT ARENA</span>
          </div>
        </Link>
        <button
          type="button"
          className="text-zinc-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => dispatch(setSidebarOpen(false))}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-black border-r border-white/8 px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex flex-col z-50 transition-transform duration-150 ease-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <Link
          to="/"
          className="flex items-center gap-3 pb-4 mb-2 border-b border-white/8 group"
          onClick={() => dispatch(setSidebarOpen(false))}
        >
          <img
            src="/logo.webp"
            alt="Chaos Computer Club Medi-Caps"
            className="w-8 h-8 object-contain shrink-0 group-hover:scale-105 transition-transform duration-150"
          />
          <div className="flex flex-col min-w-0">
            <strong className="font-sans text-xs font-bold tracking-wider text-white leading-tight">CHAOS COMPUTER CLUB</strong>
            <span className="font-sans text-[9px] font-medium text-zinc-400 tracking-wider">MEDI-CAPS CHAPTER</span>
          </div>
        </Link>

        {/* Navigation Links with Premium SaaS Sliding Active Pill */}
        <nav
          ref={navRef}
          aria-label="Portal navigation"
          className="relative flex flex-col gap-1 my-1 flex-1"
        >
          {/* Animated Active Sliding Indicator Pill */}
          <div
            aria-hidden="true"
            className={`absolute left-0 right-0 pointer-events-none rounded-md bg-white/[0.06] border border-white/10 ${
              indicatorStyle.ready
                ? "transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                : "transition-none"
            }`}
            style={{
              transform: `translate3d(0, ${indicatorStyle.top}px, 0)`,
              height: indicatorStyle.height ? `${indicatorStyle.height}px` : "36px",
              opacity: indicatorStyle.opacity,
            }}
          >
            {/* Subtle left accent marker in Electric Lime */}
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-lime-400 rounded-r-full shadow-[0_0_8px_rgba(204,255,0,0.6)]" />
          </div>

          {links.map((item) => {
            const active = item.exact
              ? cleanPath === item.to
              : cleanPath === item.to || cleanPath.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                ref={(el) => {
                  itemRefs.current[item.to] = el;
                }}
                to={item.to}
                onMouseEnter={() => prefetchRoute(item.to)}
                onFocus={() => prefetchRoute(item.to)}
                onTouchStart={() => prefetchRoute(item.to)}
                onClick={() => {
                  markNavigationClick(item.to);
                  if (open) dispatch(setSidebarOpen(false));
                }}
                className={`relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-sans select-none group min-h-[38px] active:scale-[0.98] transition-colors duration-150 ${
                  active
                    ? "text-white font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                <Icon
                  size={16}
                  className={`shrink-0 transition-colors duration-150 ${
                    active ? "text-lime-400" : "text-zinc-400 group-hover:text-zinc-200"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Identity Footer */}
        <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-2">
          <Link
            to="/profile"
            onMouseEnter={() => prefetchRoute("/profile")}
            onFocus={() => prefetchRoute("/profile")}
            onTouchStart={() => prefetchRoute("/profile")}
            onClick={() => markNavigationClick("/profile")}
            className="flex items-center gap-2.5 min-w-0 flex-1 p-1.5 rounded-md hover:bg-white/[0.04] transition-colors"
            title="View Profile"
          >
            <Avatar className="w-7 h-7 rounded-full border border-white/12 bg-black text-lime-400 shrink-0">
              {resolvedAvatar ? (
                <AvatarImage src={resolvedAvatar} alt={formattedName || displayHandle} className="object-cover" />
              ) : null}
              <AvatarFallback className="rounded-full bg-lime-400/10 text-lime-400 font-sans font-bold text-[10px]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="block font-sans text-xs font-medium text-white truncate">
                {formattedName || displayHandle}
              </span>
              <span
                className="block font-sans text-[10px] text-zinc-400 truncate"
                title={displayEmail || `@${displayHandle}`}
              >
                {displayEmail || `@${displayHandle}`}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out of CCC Portal"
            className="text-zinc-500 hover:text-red-400 p-2 rounded-md hover:bg-white/[0.05] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 active:scale-[0.96]"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 md:ml-64 min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] relative min-w-0 max-w-full overflow-x-hidden">
        <Outlet />
      </main>

      <SocialDrawer />
    </div>
  );
}
