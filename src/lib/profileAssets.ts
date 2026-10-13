/**
 * Chaos Computer Club India — Profile Asset Resolution Engine
 * Maps user telemetry (rating, tier, league, status) to authoritative visual assets.
 * Utilizes crisp vector SVGs from /graphics/ and high-res Mako WebP cutouts from /mako/.
 */

export interface TierBadgeInfo {
  src: string;
  name: string;
  color: string;
}

export interface LeagueInfo {
  name: string;
  iconSrc: string;
  medalSrc: string;
  color: string;
}

/**
 * Resolves the star division rank badge (Novice, Amateur, Candidate, Expert, Master, GrandMaster)
 */
export function getTierBadgeAsset(tier?: string | null, rating?: number | null): TierBadgeInfo {
  const r = rating ?? 1200;
  const t = (tier || "").toLowerCase();

  if (t.includes("grandmaster") || r >= 2200) {
    return {
      src: "/graphics/ranks/rank-grandmaster.svg",
      name: "GRANDMASTER",
      color: "text-red-400",
    };
  }
  if (t.includes("master") || r >= 2000) {
    return {
      src: "/graphics/ranks/rank-master.svg",
      name: "MASTER",
      color: "text-amber-400",
    };
  }
  if (t.includes("expert") || r >= 1800) {
    return {
      src: "/graphics/ranks/rank-expert.svg",
      name: "EXPERT",
      color: "text-[#B1FA63]",
    };
  }
  if (t.includes("candidate") || r >= 1600) {
    return {
      src: "/graphics/ranks/rank-candidate.svg",
      name: "CANDIDATE",
      color: "text-sky-400",
    };
  }
  if (t.includes("amateur") || r >= 1400) {
    return {
      src: "/graphics/ranks/rank-specialist.svg",
      name: "AMATEUR",
      color: "text-teal-400",
    };
  }

  // Base Novice tier (rating < 1400)
  return {
    src: "/graphics/ranks/rank-explorer.svg",
    name: "NOVICE",
    color: "text-[#B1FA63]",
  };
}

/**
 * Resolves the top hero profile banner matching the user's competitive tier
 */
export function getTierBannerAsset(tier?: string | null, rating?: number | null): string {
  const r = rating ?? 1200;
  const t = (tier || "").toLowerCase();

  if (r >= 2200 || t.includes("grandmaster")) return "/graphics/ranks/rank-grandmaster.svg";
  if (r >= 2000 || t.includes("master")) return "/graphics/ranks/rank-master.svg";
  if (r >= 1800 || t.includes("expert")) return "/graphics/ranks/rank-expert.svg";
  if (r >= 1600 || t.includes("candidate")) return "/graphics/ranks/rank-candidate.svg";
  if (r >= 1400 || t.includes("amateur")) return "/graphics/ranks/rank-specialist.svg";

  // Base Novice banner
  return "/graphics/ranks/rank-explorer.svg";
}

/**
 * Resolves league division icons and medals using vector SVGs
 */
export function getLeagueAsset(rating?: number | null): LeagueInfo {
  const r = rating ?? 1000;

  if (r >= 1900) {
    return {
      name: "DIAMOND",
      iconSrc: "/graphics/ranks/league-diamond.svg",
      medalSrc: "/graphics/ranks/league-diamond.svg",
      color: "text-cyan-400",
    };
  }
  if (r >= 1600) {
    return {
      name: "RUBY",
      iconSrc: "/graphics/ranks/league-ruby.svg",
      medalSrc: "/graphics/ranks/league-ruby.svg",
      color: "text-rose-400",
    };
  }
  if (r >= 1400) {
    return {
      name: "GOLD",
      iconSrc: "/graphics/ranks/medal-gold.svg",
      medalSrc: "/graphics/ranks/medal-gold.svg",
      color: "text-amber-400",
    };
  }
  if (r >= 1200) {
    return {
      name: "SILVER",
      iconSrc: "/graphics/ranks/medal-silver.svg",
      medalSrc: "/graphics/ranks/medal-silver.svg",
      color: "text-zinc-300",
    };
  }

  return {
    name: "BRONZE",
    iconSrc: "/graphics/ranks/medal-bronze.svg",
    medalSrc: "/graphics/ranks/medal-bronze.svg",
    color: "text-amber-600",
  };
}

/**
 * Common system icons and reward assets
 */
export const ProfileVisualAssets = {
  // Reward Coins & Tokens (Vector SVGs)
  piCoin: "/graphics/rewards/reward-token-ccc.svg",
  piCoinSvg: "/graphics/rewards/reward-token-ccc.svg",
  animatedCoin: "/graphics/rewards/reward-token-ccc.svg",

  // Stats Icons (Vector SVGs)
  streakFire: "/graphics/rewards/reward-streak-fire.svg",
  totalDuels: "/graphics/ranks/rank-candidate.svg",
  matiksBolt: "/graphics/rewards/reward-xp-spark.svg",
  shield: "/graphics/competition/contest-gate-pass.svg",
  peakRating: "/graphics/ranks/rank-master.svg",
  division: "/graphics/ranks/league-diamond.svg",
  ratingWhite: "/graphics/ranks/rank-explorer.svg",
  vsIcon: "/graphics/competition/contest-type-hackathon.svg",
  winLossIcon: "/graphics/competition/verdict-accepted.svg",
  fistIcon: "/graphics/ranks/rank-specialist.svg",

  // Game / Track Mode Icons
  blitzTrack: "/graphics/competition/contest-type-weekly.svg",
  classicTrack: "/graphics/competition/contest-type-hackathon.svg",
  memoryTrack: "/graphics/achievements/achievement-algorithm-master.svg",
  puzzleTrack: "/graphics/achievements/achievement-clean-code.svg",

  // Empty States (Standardized to unique Mako Mascot WebP cutouts)
  noDuels: "/mako/mako-gamer.webp",
  noFriends: "/mako/mako-welcome.webp",
  noFeed: "/mako/mako-workspace.webp",
  emptyLeaderboard: "/mako/mako-search.webp",
  oopsError: "/mako/mako-not-found.webp",
  noInternet: "/mako/mako-sleeping.webp",
  error: "/mako/mako-error.webp",

  // Mascots (Standardized to purposeful Mako Mascot roles)
  mascotJoy: "/mako/mako-excited.webp",
  mascotCrying: "/mako/mako-thinking.webp",
  noFriendsPookie: "/mako/mako-chill.webp",
  mascotWithWeapon: "/mako/mako-superhero.webp",
  mascotPhone: "/mako/mako-tasks.webp",

  // Illustrations
  victoryIllustration: "/mako/mako-celebrating.webp",
  defeatIllustration: "/mako/mako-error.webp",
  piBundleLarge: "/graphics/rewards/reward-token-ccc.svg",
  piBundleMedium: "/graphics/rewards/reward-token-ccc.svg",
  piBundleSmall: "/graphics/rewards/reward-token-ccc.svg",

  // Achievements & Recognition Certificates (Vector SVGs)
  contestRecognition: "/graphics/achievements/achievement-podium-finish.svg",
  survivalRecognition: "/graphics/achievements/achievement-streak-7.svg",
  showdownRecognition: "/graphics/achievements/achievement-speed-demon.svg",
  meritBadge: "/graphics/achievements/achievement-clean-code.svg",

  // Audio Effects
  questCompleteAudio: "",
  victoryAudio: "",
  defeatAudio: "",
  arrowWhooshAudio: "",
} as const;

/**
 * Authoritative chapter badge asset map matching /matiks_assets/badges
 */
export const BADGE_ASSET_MAP: Record<string, string> = {
  novice: "/matiks-assets/badges/Novice.png",
  amateur: "/matiks-assets/badges/Amateur.png",
  candidate: "/matiks-assets/badges/Candidate.png",
  expert: "/matiks-assets/badges/Expert.png",
  master: "/matiks-assets/badges/Master.png",
  grandmaster: "/matiks-assets/badges/GrandMaster.png",
};

/**
 * Resolves official chapter badge PNG asset from badge title, name, or code
 */
export function getChapterBadgeAsset(nameOrCode?: string | null): string {
  if (!nameOrCode) return "/matiks-assets/badges/badge.webp";
  const normalized = nameOrCode.toLowerCase().replace(/[^a-z]/g, "");
  return BADGE_ASSET_MAP[normalized] || "/matiks-assets/badges/badge.webp";
}

/**
 * Official set of authorized badge codes and titles from /matiks_assets/badges
 */
export const OFFICIAL_BADGE_CODES = new Set([
  "NOVICE",
  "AMATEUR",
  "CANDIDATE",
  "EXPERT",
  "MASTER",
  "GRANDMASTER",
]);

export const OFFICIAL_BADGE_TITLES = new Set([
  "Novice",
  "Amateur",
  "Candidate",
  "Expert",
  "Master",
  "GrandMaster",
]);

/**
 * Strictly verifies whether a badge item belongs to the official 6-badge catalog.
 * Discards unwanted legacy badges (e.g. Cadet Commissioned, 1_star, CCC Core Organizer).
 */
export function isOfficialChapterBadge(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  const code = (item.code || item.id || "").toString().trim().toUpperCase();
  const title = (item.title || item.name || "").toString().trim();
  const lower = `${code} ${title}`.toLowerCase();

  // Strict blacklist: permanently remove unwanted badges
  if (
    lower.includes("init") ||
    lower.includes("cadet commissioned") ||
    lower.includes("1_star") ||
    lower.includes("tier") ||
    lower.includes("core organizer") ||
    lower.includes("ccc core")
  ) {
    return false;
  }

  return OFFICIAL_BADGE_CODES.has(code) || OFFICIAL_BADGE_TITLES.has(title);
}

export interface ChapterBadgeItem {
  id: string;
  code: string;
  title: string;
  name: string;
  icon: string;
  image_url: string;
  badge_url: string;
  description: string;
  criteria: string;
  earned: boolean;
}

/**
 * Builds authoritative chapter badges strictly matching the /matiks_assets/badges folder.
 * Enforces strict criteria and strips out all legacy/unwanted badges.
 */
export function computeAuthoritativeBadges(params: {
  rating?: number | null;
  attended?: number | null;
  podiums?: number | null;
  total_solved?: number | null;
  rawAchievements?: any[] | null;
}): ChapterBadgeItem[] {
  const r = params.rating ?? 1200;
  const solves = params.total_solved ?? 0;
  const contests = params.attended ?? 0;
  const pods = params.podiums ?? 0;

  const catalog: ChapterBadgeItem[] = [
    {
      id: "badge_novice",
      code: "NOVICE",
      title: "Novice",
      name: "Novice",
      icon: "⚡",
      image_url: "/matiks-assets/badges/Novice.png",
      badge_url: "/matiks-assets/badges/Novice.png",
      description: "Solved at least 10 competitive problems and participated in an official contest (or 15+ solved problems).",
      criteria: "10+ Solves & 1 Contest (or 15+ Solves)",
      earned: Boolean((solves >= 10 && contests >= 1) || solves >= 15),
    },
    {
      id: "badge_amateur",
      code: "AMATEUR",
      title: "Amateur",
      name: "Amateur",
      icon: "🛡️",
      image_url: "/matiks-assets/badges/Amateur.png",
      badge_url: "/matiks-assets/badges/Amateur.png",
      description: "Attained rating ≥ 1400 with 25+ solved problems and 2+ official contest participations.",
      criteria: "Rating ≥ 1400, 25+ Solves, 2+ Contests",
      earned: Boolean(r >= 1400 && solves >= 25 && contests >= 2),
    },
    {
      id: "badge_candidate",
      code: "CANDIDATE",
      title: "Candidate",
      name: "Candidate",
      icon: "🎯",
      image_url: "/matiks-assets/badges/Candidate.png",
      badge_url: "/matiks-assets/badges/Candidate.png",
      description: "Attained rating ≥ 1600 with 50+ solved problems and 3+ official contest participations.",
      criteria: "Rating ≥ 1600, 50+ Solves, 3+ Contests",
      earned: Boolean(r >= 1600 && solves >= 50 && contests >= 3),
    },
    {
      id: "badge_expert",
      code: "EXPERT",
      title: "Expert",
      name: "Expert",
      icon: "🔥",
      image_url: "/matiks-assets/badges/Expert.png",
      badge_url: "/matiks-assets/badges/Expert.png",
      description: "Elite tier: Attained rating ≥ 1800 with 75+ solved problems and 5+ tournament battles.",
      criteria: "Rating ≥ 1800, 75+ Solves, 5+ Contests",
      earned: Boolean(r >= 1800 && solves >= 75 && contests >= 5),
    },
    {
      id: "badge_master",
      code: "MASTER",
      title: "Master",
      name: "Master",
      icon: "🏆",
      image_url: "/matiks-assets/badges/Master.png",
      badge_url: "/matiks-assets/badges/Master.png",
      description: "Master tier: Attained rating ≥ 2000, 100+ solved problems, and secured at least 1 official podium.",
      criteria: "Rating ≥ 2000, 100+ Solves, 1+ Podium",
      earned: Boolean(r >= 2000 && solves >= 100 && pods >= 1),
    },
    {
      id: "badge_grandmaster",
      code: "GRANDMASTER",
      title: "GrandMaster",
      name: "GrandMaster",
      icon: "👑",
      image_url: "/matiks-assets/badges/GrandMaster.png",
      badge_url: "/matiks-assets/badges/GrandMaster.png",
      description: "Pinnacle GrandMaster: Attained rating ≥ 2200, 150+ problems solved, and multiple podium victories.",
      criteria: "Rating ≥ 2200, 150+ Solves, 2+ Podiums",
      earned: Boolean(r >= 2200 && solves >= 150 && pods >= 2),
    },
  ];

  // If server returned official badges, reconcile them while rejecting legacy ones
  if (Array.isArray(params.rawAchievements) && params.rawAchievements.length > 0) {
    const validServerBadges = new Map<string, any>();
    for (const raw of params.rawAchievements) {
      if (!isOfficialChapterBadge(raw)) continue;
      const key = (raw.code || raw.title || raw.name || "").toString().trim().toUpperCase();
      validServerBadges.set(key, raw);
    }

    if (validServerBadges.size > 0) {
      return catalog.map((b) => {
        const serverMatch = validServerBadges.get(b.code) || validServerBadges.get(b.title.toUpperCase());
        if (serverMatch && typeof serverMatch.earned === "boolean") {
          return { ...b, earned: serverMatch.earned };
        }
        return b;
      });
    }
  }

  return catalog;
}

