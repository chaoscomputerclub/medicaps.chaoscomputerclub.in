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
  const r = rating ?? 1000;
  const t = (tier || "").toLowerCase();

  if (t.includes("grandmaster") || r >= 2000) {
    return {
      src: "/graphics/ranks/rank-grandmaster.svg",
      name: "GRANDMASTER",
      color: "text-red-400",
    };
  }
  if (t.includes("master") || r >= 1800) {
    return {
      src: "/graphics/ranks/rank-master.svg",
      name: "MASTER",
      color: "text-amber-400",
    };
  }
  if (t.includes("expert") || r >= 1600) {
    return {
      src: "/graphics/ranks/rank-expert.svg",
      name: "EXPERT",
      color: "text-[#B1FA63]",
    };
  }
  if (t.includes("specialist") || t.includes("candidate") || r >= 1400) {
    return {
      src: "/graphics/ranks/rank-candidate.svg",
      name: "CANDIDATE",
      color: "text-sky-400",
    };
  }
  if (t.includes("guardian") || t.includes("amateur") || r >= 1200) {
    return {
      src: "/graphics/ranks/rank-specialist.svg",
      name: "AMATEUR",
      color: "text-teal-400",
    };
  }

  // Base Novice tier (e.g. 1★ Explorer or rating < 1200)
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
  const r = rating ?? 1000;
  const t = (tier || "").toLowerCase();

  if (r >= 2100 || t.includes("grandmaster")) return "/graphics/ranks/rank-grandmaster.svg";
  if (t.includes("master") || r >= 1900) return "/graphics/ranks/rank-master.svg";
  if (t.includes("specialist") || t.includes("candidate") || r >= 1700) return "/graphics/ranks/rank-candidate.svg";
  if (t.includes("expert") || r >= 1500) return "/graphics/ranks/rank-expert.svg";
  if (t.includes("guardian") || t.includes("amateur") || r >= 1300) return "/graphics/ranks/rank-specialist.svg";

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
