import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDifficultyColorClass(bucket: string | null | undefined): string {
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
      return "bg-emerald-600 text-emerald-50"
    default:
      return "bg-zinc-800 text-zinc-400"
  }
}
