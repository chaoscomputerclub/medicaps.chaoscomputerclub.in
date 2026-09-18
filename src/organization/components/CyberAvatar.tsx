/**
 * Chaos Computer Club India — Cyber & GitHub-Ready Developer PFPs
 * High-resolution vector developer avatars designed for GitHub profiles and CCC dossiers.
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface CoolPfp {
  id: string;
  name: string;
  category: string;
  description: string;
  svgContent: string;
}

export const COOL_PFPS: CoolPfp[] = [
  {
    id: "gh-octocat-cyber",
    name: "Cyber Octocat",
    category: "GitHub Edition",
    description: "The iconic GitHub Invertocat augmented with glowing neon cyber-visor and neural telemetry.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#090A0F"/>
      <circle cx="100" cy="100" r="90" fill="#12131C" stroke="#232638" stroke-width="2"/>
      <path d="M40 160C45 130 65 115 100 115C135 115 155 130 160 160" fill="#1C1F2E" stroke="#CCFF00" stroke-width="2"/>
      <!-- Octocat Ears -->
      <path d="M60 70L75 42L95 62" fill="#1C1F2E" stroke="#CCFF00" stroke-width="2" stroke-linejoin="round"/>
      <path d="M140 70L125 42L105 62" fill="#1C1F2E" stroke="#CCFF00" stroke-width="2" stroke-linejoin="round"/>
      <!-- Head -->
      <ellipse cx="100" cy="85" rx="42" ry="38" fill="#161824" stroke="#CCFF00" stroke-width="2.5"/>
      <!-- Cyber Visor -->
      <rect x="68" y="74" width="64" height="18" rx="2" fill="#CCFF00" fill-opacity="0.15" stroke="#CCFF00" stroke-width="2"/>
      <line x1="72" y1="83" x2="128" y2="83" stroke="#CCFF00" stroke-width="2" stroke-dasharray="4 2"/>
      <!-- HUD Dots -->
      <circle cx="76" cy="83" r="2.5" fill="#CCFF00"/>
      <circle cx="124" cy="83" r="2.5" fill="#CCFF00"/>
      <!-- Whiskers -->
      <line x1="60" y1="95" x2="42" y2="92" stroke="#CCFF00" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="60" y1="100" x2="40" y2="102" stroke="#CCFF00" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="140" y1="95" x2="158" y2="92" stroke="#CCFF00" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="140" y1="100" x2="160" y2="102" stroke="#CCFF00" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Nose & Mouth -->
      <polygon points="100,94 97,97 103,97" fill="#CCFF00"/>
      <path d="M96 101C98 103 100 103 100 101C100 103 102 103 104 101" stroke="#CCFF00" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Matrix Code Elements -->
      <text x="100" y="180" fill="#CCFF00" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="3">01 // OCTO_CORE</text>
    </svg>`,
  },
  {
    id: "gh-matrix-visor",
    name: "Neon Matrix Visor",
    category: "Tactical Ops",
    description: "Military-grade carbon-fiber helmet with horizontal high-frequency scanning beam.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#060907"/>
      <!-- Hexagon Grid BG -->
      <circle cx="100" cy="100" r="88" fill="#0C140E" stroke="#1B3320" stroke-width="2"/>
      <!-- Helmet Outer Shell -->
      <path d="M50 85C50 50 72 35 100 35C128 35 150 50 150 85C150 120 135 155 100 162C65 155 50 120 50 85Z" fill="#121D15" stroke="#2A4D31" stroke-width="3"/>
      <!-- Cheek plates -->
      <polygon points="56,90 70,140 54,125" fill="#0B130E" stroke="#33663E" stroke-width="1.5"/>
      <polygon points="144,90 130,140 146,125" fill="#0B130E" stroke="#33663E" stroke-width="1.5"/>
      <!-- Visor Housing -->
      <rect x="62" y="70" width="76" height="26" rx="2" fill="#000000" stroke="#CCFF00" stroke-width="2"/>
      <!-- Glowing Scanner Beam -->
      <rect x="65" y="79" width="70" height="8" rx="1" fill="#CCFF00" filter="drop-shadow(0 0 6px #CCFF00)"/>
      <line x1="68" y1="83" x2="132" y2="83" stroke="#FFFFFF" stroke-width="2"/>
      <!-- Air Filtration Grate -->
      <rect x="86" y="125" width="28" height="20" rx="2" fill="#080D09" stroke="#25422B" stroke-width="1.5"/>
      <line x1="90" y1="130" x2="110" y2="130" stroke="#CCFF00" stroke-width="1.5"/>
      <line x1="90" y1="135" x2="110" y2="135" stroke="#CCFF00" stroke-width="1.5"/>
      <line x1="90" y1="140" x2="110" y2="140" stroke="#CCFF00" stroke-width="1.5"/>
      <text x="100" y="182" fill="#CCFF00" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="3">TAC // VISOR_02</text>
    </svg>`,
  },
  {
    id: "gh-retro-identicon",
    name: "Retro Identicon",
    category: "Classic GitHub",
    description: "GitHub-native 5x5 procedural geometric identicon rendered in electric lime and obsidian.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#07080A"/>
      <rect x="25" y="25" width="150" height="150" rx="4" fill="#0F1117" stroke="#242838" stroke-width="2"/>
      <!-- 5x5 Symmetrical Identicon Grid (30px cells, offset 25px) -->
      <!-- Row 1 -->
      <rect x="55" y="40" width="30" height="30" fill="#CCFF00"/>
      <rect x="85" y="40" width="30" height="30" fill="#0F1117"/>
      <rect x="115" y="40" width="30" height="30" fill="#CCFF00"/>
      <!-- Row 2 -->
      <rect x="25" y="70" width="30" height="30" fill="#CCFF00"/>
      <rect x="55" y="70" width="30" height="30" fill="#CCFF00"/>
      <rect x="85" y="70" width="30" height="30" fill="#CCFF00"/>
      <rect x="115" y="70" width="30" height="30" fill="#CCFF00"/>
      <rect x="145" y="70" width="30" height="30" fill="#CCFF00"/>
      <!-- Row 3 -->
      <rect x="25" y="100" width="30" height="30" fill="#0F1117"/>
      <rect x="55" y="100" width="30" height="30" fill="#CCFF00"/>
      <rect x="85" y="100" width="30" height="30" fill="#0F1117"/>
      <rect x="115" y="100" width="30" height="30" fill="#CCFF00"/>
      <rect x="145" y="100" width="30" height="30" fill="#0F1117"/>
      <!-- Row 4 -->
      <rect x="55" y="130" width="30" height="30" fill="#CCFF00"/>
      <rect x="85" y="130" width="30" height="30" fill="#CCFF00"/>
      <rect x="115" y="130" width="30" height="30" fill="#CCFF00"/>
      <!-- Border accent -->
      <rect x="25" y="25" width="150" height="150" fill="none" stroke="#CCFF00" stroke-width="2" stroke-dasharray="8 6"/>
      <text x="100" y="190" fill="#888888" font-family="monospace" font-size="8" text-anchor="middle" letter-spacing="2">HASH_SHA256(CADET)</text>
    </svg>`,
  },
  {
    id: "gh-terminal-phantom",
    name: "Terminal Phantom",
    category: "Hacker Aesthetic",
    description: "Faceless hooded silhouette with glowing terminal command prompts and green phosphor text.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#050608"/>
      <circle cx="100" cy="100" r="88" fill="#0B0E14" stroke="#1F2636" stroke-width="2"/>
      <!-- Hood Outer -->
      <path d="M42 165C45 110 55 52 100 40C145 52 155 110 158 165C135 158 115 155 100 155C85 155 65 158 42 165Z" fill="#131722" stroke="#2D364D" stroke-width="2.5"/>
      <!-- Hood Inner Void -->
      <path d="M62 135C65 95 75 66 100 60C125 66 135 95 138 135C125 140 112 142 100 142C88 142 75 140 62 135Z" fill="#000000"/>
      <!-- Terminal Prompt in Void -->
      <text x="100" y="98" fill="#CCFF00" font-family="monospace" font-size="22" font-weight="bold" text-anchor="middle">&gt;_</text>
      <line x1="84" y1="112" x2="116" y2="112" stroke="#CCFF00" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="90" y1="120" x2="110" y2="120" stroke="#CCFF00" stroke-width="1.5" stroke-opacity="0.6" stroke-linecap="round"/>
      <text x="100" y="184" fill="#CCFF00" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="3">ROOT@PHANTOM:~#</text>
    </svg>`,
  },
  {
    id: "gh-quantum-circuit",
    name: "Quantum Qubit",
    category: "Deep Tech",
    description: "Futuristic violet quantum processor node with orbital geometric waveguides.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#0A0612"/>
      <circle cx="100" cy="100" r="88" fill="#120B21" stroke="#2F1B54" stroke-width="2"/>
      <!-- Orbital Rings -->
      <ellipse cx="100" cy="100" rx="72" ry="26" stroke="#A855F7" stroke-width="1.5" transform="rotate(-30 100 100)" stroke-dasharray="6 3"/>
      <ellipse cx="100" cy="100" rx="72" ry="26" stroke="#06B6D4" stroke-width="1.5" transform="rotate(30 100 100)"/>
      <ellipse cx="100" cy="100" rx="72" ry="26" stroke="#CCFF00" stroke-width="1.5" transform="rotate(90 100 100)" stroke-dasharray="4 4"/>
      <!-- Central Core Sphere -->
      <circle cx="100" cy="100" r="28" fill="#1E1038" stroke="#C084FC" stroke-width="3"/>
      <circle cx="100" cy="100" r="14" fill="#CCFF00"/>
      <!-- Qubit Nodes -->
      <circle cx="48" cy="70" r="4.5" fill="#06B6D4"/>
      <circle cx="152" cy="130" r="4.5" fill="#06B6D4"/>
      <circle cx="152" cy="70" r="4.5" fill="#A855F7"/>
      <circle cx="48" cy="130" r="4.5" fill="#A855F7"/>
      <circle cx="100" cy="30" r="5" fill="#CCFF00"/>
      <circle cx="100" cy="170" r="5" fill="#CCFF00"/>
      <text x="100" y="184" fill="#C084FC" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="3">QUBIT // 128_ENTANGLED</text>
    </svg>`,
  },
  {
    id: "gh-synth-cadet",
    name: "Synthwave Cadet",
    category: "Retro Cyber",
    description: "Retro-futuristic visor helmet with glowing wireframe horizon and neon magenta accents.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#080714"/>
      <circle cx="100" cy="100" r="88" fill="#100E26" stroke="#29245C" stroke-width="2"/>
      <!-- Neon Sun BG -->
      <circle cx="100" cy="85" r="45" fill="#F43F5E"/>
      <rect x="55" y="75" width="90" height="3" fill="#100E26"/>
      <rect x="55" y="83" width="90" height="4" fill="#100E26"/>
      <rect x="55" y="92" width="90" height="5" fill="#100E26"/>
      <rect x="55" y="102" width="90" height="6" fill="#100E26"/>
      <!-- Wireframe Grid Horizon -->
      <polygon points="25,145 175,145 190,190 10,190" fill="#0D0B21" stroke="#06B6D4" stroke-width="1.5"/>
      <line x1="100" y1="145" x2="100" y2="190" stroke="#06B6D4" stroke-width="1.5"/>
      <line x1="75" y1="145" x2="55" y2="190" stroke="#06B6D4" stroke-width="1.5"/>
      <line x1="125" y1="145" x2="145" y2="190" stroke="#06B6D4" stroke-width="1.5"/>
      <!-- Cyber Pilot Silhouette -->
      <path d="M78 145C80 120 90 110 100 110C110 110 120 120 122 145Z" fill="#05030A" stroke="#CCFF00" stroke-width="2"/>
      <ellipse cx="100" cy="126" rx="14" ry="7" fill="#CCFF00"/>
      <text x="100" y="184" fill="#F43F5E" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="3">SYNTH // PROTOCOL</text>
    </svg>`,
  },
  {
    id: "gh-grandmaster",
    name: "Grandmaster Shield",
    category: "Competitive Rank",
    description: "Heavy tactical crest awarded to tournament champions, podium finishers, and algorithm grandmasters.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#0A0802"/>
      <circle cx="100" cy="100" r="88" fill="#141105" stroke="#382E0B" stroke-width="2"/>
      <!-- Shield Outer -->
      <path d="M100 35L155 58V115C155 145 130 168 100 176C70 168 45 145 45 115V58L100 35Z" fill="#1C1808" stroke="#EAB308" stroke-width="3"/>
      <!-- Inner Shield Plate -->
      <path d="M100 48L142 66V112C142 136 122 154 100 162C78 154 58 136 58 112V66L100 48Z" fill="#0D0B04" stroke="#CCFF00" stroke-width="2"/>
      <!-- Grandmaster Star Trophy -->
      <polygon points="100,75 106,94 125,94 110,105 116,124 100,112 84,124 90,105 75,94 94,94" fill="#CCFF00" stroke="#FFFFFF" stroke-width="1"/>
      <text x="100" y="148" fill="#EAB308" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle" letter-spacing="2">RANK: 01</text>
      <text x="100" y="184" fill="#CCFF00" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="3">GRANDMASTER // CCC</text>
    </svg>`,
  },
  {
    id: "gh-binary-android",
    name: "Binary Spectre",
    category: "AI & Stealth",
    description: "Minimalist stealth cybernetic android with dual glowing cyan sensor optics and circuit traces.",
    svgContent: `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#04070A"/>
      <circle cx="100" cy="100" r="88" fill="#0A0F16" stroke="#1B293A" stroke-width="2"/>
      <!-- Face Chassis -->
      <polygon points="70,55 130,55 145,95 130,150 100,165 70,150 55,95" fill="#101824" stroke="#00F0FF" stroke-width="2"/>
      <!-- Temples -->
      <line x1="45" y1="95" x2="55" y2="95" stroke="#00F0FF" stroke-width="2"/>
      <line x1="145" y1="95" x2="155" y2="95" stroke="#00F0FF" stroke-width="2"/>
      <!-- Dual Optic Sensor Eyes -->
      <rect x="76" y="85" width="18" height="12" rx="2" fill="#00F0FF" filter="drop-shadow(0 0 4px #00F0FF)"/>
      <rect x="106" y="85" width="18" height="12" rx="2" fill="#00F0FF" filter="drop-shadow(0 0 4px #00F0FF)"/>
      <line x1="72" y1="91" x2="128" y2="91" stroke="#FFFFFF" stroke-width="1.5"/>
      <!-- Mouth Speaker Lines -->
      <line x1="88" y1="128" x2="112" y2="128" stroke="#00F0FF" stroke-width="2"/>
      <line x1="92" y1="134" x2="108" y2="134" stroke="#00F0FF" stroke-width="1.5"/>
      <!-- Circuit Nodes -->
      <circle cx="100" cy="55" r="3" fill="#00F0FF"/>
      <text x="100" y="184" fill="#00F0FF" font-family="monospace" font-size="9" text-anchor="middle" letter-spacing="3">SPECTRE // AI_CORE</text>
    </svg>`,
  },
];

// Mapping for legacy emblem strings
export const LEGACY_EMBLEM_REDIRECT: Record<string, string> = {
  volt: "gh-octocat-cyber",
  binary: "gh-binary-android",
  quantum: "gh-quantum-circuit",
  matrix: "gh-matrix-visor",
  grandmaster: "gh-grandmaster",
  cipher: "gh-terminal-phantom",
};

/**
 * Returns the CoolPfp object matching the given ID (with backward compatibility).
 */
export function getCoolPfp(id: string | null | undefined): CoolPfp | undefined {
  if (!id) return undefined;
  const canonicalId = LEGACY_EMBLEM_REDIRECT[id] || id;
  return COOL_PFPS.find((p) => p.id === canonicalId);
}

/**
 * Triggers a client-side download of the avatar as a high-resolution SVG file,
 * formatted and ready to be uploaded directly to GitHub profile settings!
 */
export function downloadCoolPfp(pfp: CoolPfp, username: string = "github-pfp") {
  const blob = new Blob([pfp.svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${username}-${pfp.id}-pfp.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface CyberAvatarProps {
  avatarUrl?: string | null;
  fallbackText?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

/**
 * Universal Cyber Avatar renderer that handles custom image uploads,
 * GitHub-ready vector SVG avatars, and elegant initials fallback.
 */
export function CyberAvatar({
  avatarUrl,
  fallbackText = "CC",
  className,
}: CyberAvatarProps) {
  const coolPfp = getCoolPfp(avatarUrl);

  if (avatarUrl && (avatarUrl.startsWith("http") || avatarUrl.startsWith("/media/") || avatarUrl.startsWith("/") || avatarUrl.startsWith("data:"))) {
    return (
      <img
        src={avatarUrl}
        alt="Cadet Avatar"
        className={cn("w-full h-full object-cover rounded-none", className)}
      />
    );
  }

  if (coolPfp) {
    return (
      <div
        className={cn("w-full h-full flex items-center justify-center overflow-hidden", className)}
        dangerouslySetInnerHTML={{ __html: coolPfp.svgContent }}
      />
    );
  }

  // Fallback initial
  return (
    <div
      className={cn(
        "w-full h-full bg-lime-400 text-black font-mono font-bold flex items-center justify-center text-sm select-none",
        className
      )}
    >
      {fallbackText.slice(0, 2).toUpperCase()}
    </div>
  );
}
