/**
 * Chaos Computer Club India — Profile Asset Resolution Engine
 * Maps user telemetry (rating, tier, league, status) to authoritative visual assets.
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
      src: "/matiks-assets/badges/GrandMaster.png",
      name: "GRANDMASTER",
      color: "text-red-400",
    };
  }
  if (t.includes("master") || r >= 1800) {
    return {
      src: "/matiks-assets/badges/Master.png",
      name: "MASTER",
      color: "text-amber-400",
    };
  }
  if (t.includes("expert") || r >= 1600) {
    return {
      src: "/matiks-assets/badges/Expert.png",
      name: "EXPERT",
      color: "text-purple-400",
    };
  }
  if (t.includes("specialist") || t.includes("candidate") || r >= 1400) {
    return {
      src: "/matiks-assets/badges/Candidate.png",
      name: "CANDIDATE",
      color: "text-sky-400",
    };
  }
  if (t.includes("guardian") || t.includes("amateur") || r >= 1200) {
    return {
      src: "/matiks-assets/badges/Amateur.png",
      name: "AMATEUR",
      color: "text-teal-400",
    };
  }

  // Base Novice tier (e.g. 1★ Explorer or rating < 1200)
  return {
    src: "/matiks-assets/badges/Novice.png",
    name: "NOVICE",
    color: "text-teal-400",
  };
}

/**
 * Resolves the top hero profile banner matching the user's competitive tier
 */
export function getTierBannerAsset(tier?: string | null, rating?: number | null): string {
  const r = rating ?? 1000;
  const t = (tier || "").toLowerCase();

  if (r >= 2100) return "/matiks-assets/ranks/goated.webp";
  if (t.includes("grandmaster") || r >= 1900) return "/matiks-assets/ranks/grand_master.webp";
  if (t.includes("master") || r >= 1700) return "/matiks-assets/ranks/master.webp";
  if (t.includes("specialist") || t.includes("candidate") || r >= 1500) return "/matiks-assets/ranks/candidate.webp";
  if (t.includes("expert") || r >= 1350) return "/matiks-assets/ranks/expert.webp";
  if (t.includes("guardian") || t.includes("amateur") || r >= 1200) return "/matiks-assets/ranks/amatuer.webp";
  if (r >= 1100) return "/matiks-assets/ranks/rookie.webp";

  // Base Novice banner (the warm amber starburst banner from the user screenshot)
  return "/matiks-assets/ranks/novice.webp";
}

/**
 * Resolves league division icons and medals
 */
export function getLeagueAsset(rating?: number | null): LeagueInfo {
  const r = rating ?? 1000;

  if (r >= 1900) {
    return {
      name: "DIAMOND",
      iconSrc: "/matiks-assets/ranks/diamond_icon.webp",
      medalSrc: "/matiks-assets/ranks/Diamond.webp",
      color: "text-cyan-400",
    };
  }
  if (r >= 1600) {
    return {
      name: "RUBY",
      iconSrc: "/matiks-assets/ranks/ruby_icon.webp",
      medalSrc: "/matiks-assets/ranks/Ruby.webp",
      color: "text-rose-400",
    };
  }
  if (r >= 1400) {
    return {
      name: "GOLD",
      iconSrc: "/matiks-assets/ranks/gold_icon.webp",
      medalSrc: "/matiks-assets/ranks/Gold.webp",
      color: "text-amber-400",
    };
  }
  if (r >= 1200) {
    return {
      name: "SILVER",
      iconSrc: "/matiks-assets/ranks/silver_icon.webp",
      medalSrc: "/matiks-assets/ranks/Silver.webp",
      color: "text-zinc-300",
    };
  }

  return {
    name: "BRONZE",
    iconSrc: "/matiks-assets/ranks/bronze_icon.webp",
    medalSrc: "/matiks-assets/ranks/Bronze.webp",
    color: "text-amber-600",
  };
}

/**
 * Common system icons and reward assets
 */
export const ProfileVisualAssets = {
  // Reward Coins
  piCoin: "/matiks-assets/rewards/piCoin-transformed.webp",
  piCoinSvg: "/matiks-assets/rewards/piCoinSvg.webp",
  animatedCoin: "/matiks-assets/animations/coin.gif",

  // Stats Icons
  streakFire: "/matiks-assets/icons/fire.png",
  totalDuels: "/matiks-assets/other/duel.png",
  matiksBolt: "/matiks-assets/icons/matiksBolt.png",
  shield: "/matiks-assets/icons/shield_icon.png",
  peakRating: "/matiks-assets/ranks/peak_rating.png",
  division: "/matiks-assets/ranks/division.png",
  ratingWhite: "/matiks-assets/icons/ratingIconWhite.png",
  vsIcon: "/matiks-assets/icons/vs.png",
  winLossIcon: "/matiks-assets/icons/win_loss.png",
  fistIcon: "/matiks-assets/icons/fistIcon.png",

  // Game / Track Mode Icons
  blitzTrack: "/matiks-assets/icons/blitz_home.png",
  classicTrack: "/matiks-assets/icons/classic_home.png",
  memoryTrack: "/matiks-assets/icons/memory.png",
  puzzleTrack: "/matiks-assets/icons/puzzle_icon.png",

  // Empty States
  noDuels: "/matiks-assets/empty-states/no_duels_to_flex.png",
  noFriends: "/matiks-assets/empty-states/no_Friends.webp",
  noFeed: "/matiks-assets/empty-states/no_feed.webp",
  emptyLeaderboard: "/matiks-assets/empty-states/empty_leaderboard.png",
  oopsError: "/matiks-assets/empty-states/oops_error.webp",
  noInternet: "/matiks-assets/empty-states/no_internet.webp",
  error: "/matiks-assets/empty-states/error.png",

  // Mascots
  mascotJoy: "/matiks-assets/mascots/mascot_joy.webp",
  mascotCrying: "/matiks-assets/mascots/mascot_crying.webp",
  noFriendsPookie: "/matiks-assets/mascots/no_friends_pookie.png",
  mascotWithWeapon: "/matiks-assets/mascots/mascot_with_weapon.webp",
  mascotPhone: "/matiks-assets/mascots/landingPageMascotWithPhone.webp",

  // Illustrations
  victoryIllustration: "/matiks-assets/illustrations/victory.webp",
  defeatIllustration: "/matiks-assets/illustrations/defeat.webp",
  piBundleLarge: "/matiks-assets/illustrations/piBundleIllustrationLarge.webp",
  piBundleMedium: "/matiks-assets/illustrations/piBundleIllustrationMedium.webp",
  piBundleSmall: "/matiks-assets/illustrations/piBundleIllustrationSmall.webp",

  // Achievements & Recognition Certificates
  contestRecognition: "/matiks-assets/achievements/ContestRecognition.webp",
  survivalRecognition: "/matiks-assets/achievements/SurvivalSaturdayRecognition.webp",
  showdownRecognition: "/matiks-assets/achievements/ShowdownRecognition.webp",
  meritBadge: "/matiks-assets/badges/badge.webp",

  // Audio Effects
  questCompleteAudio: "/matiks-assets/rewards/quest_complete.mp3",
  victoryAudio: "/matiks-assets/illustrations/victory.mp3",
  defeatAudio: "/matiks-assets/illustrations/defeat.mp3",
  arrowWhooshAudio: "/matiks-assets/navigation/arrow_whoosh.wav",
} as const;
