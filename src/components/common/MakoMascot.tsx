import React from "react";
import { cn } from "@/lib/utils";

export type MakoVariant =
  | "coder"
  | "workspace"
  | "welcome"
  | "search"
  | "detective-winking"
  | "excited"
  | "celebrating"
  | "superhero"
  | "chill"
  | "ready"
  | "thinking"
  | "gamer"
  | "success"
  | "loading"
  | "idea"
  | "not-found"
  | "learning"
  | "tasks"
  | "winner"
  | "error"
  | "sleeping"
  | "roadmap"
  | "maintenance";

const MAKO_ASSETS: Record<MakoVariant, { src: string; alt: string }> = {
  coder: {
    src: "/mako/mako-coder.webp",
    alt: "Mako typing on laptop with backpack",
  },
  workspace: {
    src: "/mako/mako-workspace.webp",
    alt: "Mako coding in terminal workspace",
  },
  welcome: {
    src: "/mako/mako-welcome.webp",
    alt: "Mako waving cheerfully with sparkling aura",
  },
  search: {
    src: "/mako/mako-search.webp",
    alt: "Mako detective searching with magnifying glass",
  },
  "detective-winking": {
    src: "/mako/mako-detective-winking.webp",
    alt: "Mako detective winking with magnifying glass",
  },
  excited: {
    src: "/mako/mako-excited.webp",
    alt: "Mako cheering with fist pump and stars",
  },
  celebrating: {
    src: "/mako/mako-celebrating.webp",
    alt: "Mako celebrating with confetti streamers",
  },
  superhero: {
    src: "/mako/mako-superhero.webp",
    alt: "Mako superhero with flowing red cape",
  },
  chill: {
    src: "/mako/mako-chill.webp",
    alt: "Mako relaxing with steaming coffee mug",
  },
  ready: {
    src: "/mako/mako-ready.webp",
    alt: "Mako energetic and ready to compete",
  },
  thinking: {
    src: "/mako/mako-thinking.webp",
    alt: "Mako pondering with paw on chin",
  },
  gamer: {
    src: "/mako/mako-gamer.webp",
    alt: "Mako gaming with headset headphones",
  },
  success: {
    src: "/mako/mako-success.webp",
    alt: "Mako winking with enthusiastic thumbs up",
  },
  loading: {
    src: "/mako/mako-loading.webp",
    alt: "Mako sprinting with speed lines",
  },
  idea: {
    src: "/mako/mako-idea.webp",
    alt: "Mako holding glowing yellow lightbulb",
  },
  "not-found": {
    src: "/mako/mako-not-found.webp",
    alt: "Mako confused with question mark",
  },
  learning: {
    src: "/mako/mako-learning.webp",
    alt: "Mako reading book on stack of books",
  },
  tasks: {
    src: "/mako/mako-tasks.webp",
    alt: "Mako holding checklist clipboard",
  },
  winner: {
    src: "/mako/mako-winner.webp",
    alt: "Mako winking holding gold championship trophy",
  },
  error: {
    src: "/mako/mako-error.webp",
    alt: "Mako holding red X warning badge",
  },
  sleeping: {
    src: "/mako/mako-sleeping.webp",
    alt: "Mako sleeping peacefully with Zzz",
  },
  roadmap: {
    src: "/mako/mako-roadmap.webp",
    alt: "Mako holding exploration map",
  },
  maintenance: {
    src: "/mako/mako-maintenance.webp",
    alt: "Mako wearing hardhat and holding wrench",
  },
};

const SIZE_CLASSES = {
  xs: "w-8 h-8",
  sm: "w-12 h-12",
  md: "w-16 h-16 sm:w-20 sm:h-20",
  lg: "w-24 h-24 sm:w-28 sm:h-28",
  xl: "w-32 h-32 sm:w-36 sm:h-36",
  "2xl": "w-44 h-44 sm:w-48 sm:h-48",
  "3xl": "w-56 h-56 sm:w-64 sm:h-64",
};

export interface MakoMascotProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant: MakoVariant;
  size?: keyof typeof SIZE_CLASSES;
  interactive?: boolean;
  priority?: boolean;
}

export function MakoMascot({
  variant,
  size = "md",
  className,
  alt,
  interactive = false,
  priority = false,
  ...props
}: MakoMascotProps) {
  const asset = MAKO_ASSETS[variant] || MAKO_ASSETS.coder;

  return (
    <img
      src={asset.src}
      alt={alt || asset.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn(
        "object-contain select-none pointer-events-none inline-block",
        SIZE_CLASSES[size],
        interactive && "pointer-events-auto cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95",
        className
      )}
      {...props}
    />
  );
}

export function getMakoAsset(variant: MakoVariant) {
  return MAKO_ASSETS[variant] || MAKO_ASSETS.coder;
}
