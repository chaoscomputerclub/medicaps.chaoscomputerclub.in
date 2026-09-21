import { SocialDrawer } from "./SocialDrawer";
import { fetchMyFollowingIdsThunk } from "@/store/slices/socialSlice";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  SquaresFour,
  Trophy,
  BookmarkSimple,
  ChartBar,
  Code,
  ShieldCheck,
  Gear,
  SignOut,
  List,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState, Suspense } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleSidebar, setSidebarOpen } from "@/store/slices/uiSlice";
import { logout, fetchCurrentUserThunk } from "@/store/slices/authSlice";
import { getToken, decodeJwtPayload } from "@/lib/auth";
import { formatFullName, resolveAvatarUrl } from "@/lib/utils";
import {
  ContestsHubSkeleton,
  ContestDetailSkeleton,
  LeaderboardSkeleton,
  MyContestsSkeleton,
  ProblemArchiveSkeleton,
  ProblemDetailSkeleton,
  ProfileSkeleton,
  SettingsSkeleton,
  VerifyProofSkeleton,
  DashboardSkeleton,
  AssessmentStudioSkeleton,
} from "./skeletons";

const links = [
  { to: "/", label: "Dashboard", icon: SquaresFour, exact: true },
  { to: "/contests", label: "Contests", icon: Trophy, exact: false },
  { to: "/my-contests", label: "My Contests", icon: BookmarkSimple, exact: false },
  { to: "/leaderboard", label: "Leaderboard", icon: ChartBar, exact: true },
  { to: "/problems", label: "Problems", icon: Code, exact: false },
  { to: "/verify", label: "Verify Proof", icon: ShieldCheck, exact: false },
  { to: "/settings", label: "Settings", icon: Gear, exact: false },
] as const;

function PortalRouteSkeleton() {
  const { pathname } = useLocation();
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  if (cleanPath === "/contests") {
    return <ContestsHubSkeleton />;
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
  if (cleanPath.startsWith("/verify")) {
    return <VerifyProofSkeleton />;
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

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/auth");
      return;
    }
    dispatch(fetchMyFollowingIdsThunk());
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

  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  const isFullscreenWorkspace = cleanPath.includes("/assessment") || cleanPath.includes("/arena");

  if (isFullscreenWorkspace) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Suspense fallback={<AssessmentStudioSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row antialiased selection:bg-lime-400 selection:text-black">
      {/* Mobile Topbar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/8 bg-black sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Chaos Computer Club" className="w-7 h-7 object-contain" />
          <div className="flex flex-col">
            <span className="font-sans font-bold text-xs tracking-wider text-white leading-none">CCC MEDI-CAPS</span>
            <span className="font-sans text-[8px] text-zinc-500 tracking-widest mt-0.5">TOURNAMENT ARENA</span>
          </div>
        </Link>
        <button
          type="button"
          className="text-zinc-400 hover:text-white p-1.5 rounded-md hover:bg-zinc-900 transition-colors"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <List size={20} />}
        </button>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={() => dispatch(setSidebarOpen(false))}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-black border-r border-white/8 px-4 py-4 flex flex-col z-50 transition-transform duration-150 ease-out md:translate-x-0 ${
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
            src="/logo.png"
            alt="Chaos Computer Club Medi-Caps"
            className="w-8 h-8 object-contain shrink-0 group-hover:scale-105 transition-transform duration-150"
          />
          <div className="flex flex-col min-w-0">
            <strong className="font-sans text-xs font-bold tracking-wider text-white leading-tight">CHAOS COMPUTER CLUB</strong>
            <span className="font-sans text-[9px] font-medium text-zinc-400 tracking-wider">MEDI-CAPS CHAPTER</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav aria-label="Portal navigation" className="flex flex-col gap-0.5 my-1 flex-1">
          {links.map((item) => {
            const active = item.exact
              ? cleanPath === item.to
              : cleanPath === item.to || cleanPath.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => dispatch(setSidebarOpen(false))}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-sans transition-colors duration-150 ${
                  active
                    ? "bg-lime-400/8 text-lime-400 border-l-2 border-lime-400 font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/50 font-medium"
                }`}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Identity Footer */}
        <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-2">
          <Link
            to="/profile"
            className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-90 transition-opacity"
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
              <span className="block font-sans text-[10px] text-lime-400 truncate tabular-nums">
                {member?.rating ? `${member.rating} Elo` : "@" + displayHandle}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => dispatch(logout())}
            aria-label="Sign out"
            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md hover:bg-zinc-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400"
          >
            <SignOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 md:ml-64 min-h-screen bg-black p-4 md:p-8 relative">
        <Suspense fallback={<PortalRouteSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <SocialDrawer />
    </div>
  );
}
