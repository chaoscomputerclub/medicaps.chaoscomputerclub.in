import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gracefully formats user full name into Title Case, handling mixed casing (e.g. "santusht Kotai" -> "Santusht Kotai").
 */
export function formatFullName(name?: string | null): string {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === "cadet") return "";
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extracts first name for warm, personalized greetings, falling back gracefully.
 */
export function getFirstName(name?: string | null, fallback?: string | null): string {
  const formatted = formatFullName(name);
  if (formatted) return formatted.split(" ")[0];
  if (fallback && typeof fallback === "string" && fallback.trim().toLowerCase() !== "cadet") {
    const clean = fallback.trim().replace(/^@/, "");
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return "Cadet";
}

/**
 * Resolves avatar image URLs whether absolute (MinIO / S3) or relative (/media/...).
 */
export function resolveAvatarUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("/media/")) {
    return `https://medicaps.chaoscomputerclub.in${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    return `https://medicaps.chaoscomputerclub.in${trimmed}`;
  }
  return trimmed;
}
