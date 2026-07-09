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

/**
 * Map a rest-of-season schedule rank (1 = easiest remaining schedule … 32 =
 * hardest) onto the same difficulty buckets used for weekly/PO matchup cells, so
 * the ROS aFPA-average column can share their green→red shading. Easiest lands in
 * the green (SMASH/FAVORABLE) buckets and hardest in the red (TOUGH/VERY_TOUGH),
 * matching the "higher aFPA = easier = green" language of PO2/PO3. Bucket sizes
 * (5/5/12/5/5 of 32) mirror the weekly-cell thresholds.
 */
export function bucketFromScheduleRank(rank: number | null | undefined): string | null {
  if (rank == null) return null
  if (rank <= 5) return "SMASH_SPOT"
  if (rank <= 10) return "FAVORABLE"
  if (rank <= 22) return "NEUTRAL"
  if (rank <= 27) return "TOUGH"
  return "VERY_TOUGH"
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
      return "bg-emerald-600 text-emerald-50"
    case "SMASH_SPOT":
      return "bg-emerald-800 text-emerald-100 font-bold"
    default:
      return "bg-zinc-800 text-zinc-400"
  }
}
