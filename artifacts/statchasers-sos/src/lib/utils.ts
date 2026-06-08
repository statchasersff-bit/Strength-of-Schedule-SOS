import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * ESPN team-logo CDN URL for a team abbreviation (e.g. "PHI" -> .../phi.png).
 * ESPN serves every abbreviation used in our data as a lowercase slug.
 */
export function getTeamLogoUrl(team?: string | null): string | null {
  if (!team) return null
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${team.toLowerCase()}.png`
}

export function getDifficultyColorClass(
  bucket: string | null | undefined,
  isBye?: boolean,
): string {
  if (isBye) return "bg-zinc-800/40 text-zinc-500 italic"
  switch (bucket) {
    case "VERY_TOUGH":
      return "bg-red-900 text-red-100"
    case "TOUGH":
      return "bg-orange-800 text-orange-100"
    case "NEUTRAL":
      return "bg-zinc-700 text-zinc-100"
    case "FAVORABLE":
      return "bg-emerald-800 text-emerald-100"
    case "SMASH_SPOT":
      return "bg-emerald-600 text-emerald-50 font-bold"
    default:
      return "bg-zinc-800 text-zinc-400"
  }
}
