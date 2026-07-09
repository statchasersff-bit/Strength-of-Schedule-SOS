import { Info } from "lucide-react";
import { cn, getDifficultyColorClass } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Ordered easiest matchup (most fantasy points allowed) -> toughest, matching
// the color scale used in the weekly cells. The ranges mirror the rank
// thresholds in scripts/src/sos-lib.ts `bucketFromRank` (32 defenses, rank 1 =
// toughest, rank 32 = easiest). Keep buckets and thresholds in sync with both files.
const LEGEND_ITEMS: { bucket: string; label: string; range: string }[] = [
  { bucket: "SMASH_SPOT", label: "Smash", range: "ranks 28-32" },
  { bucket: "FAVORABLE", label: "Favorable", range: "ranks 23-27" },
  { bucket: "NEUTRAL", label: "Neutral", range: "ranks 11-22" },
  { bucket: "TOUGH", label: "Tough", range: "ranks 6-10" },
  { bucket: "VERY_TOUGH", label: "Avoid", range: "ranks 1-5" },
];

/**
 * Color key explaining the matchup-difficulty shading in the SOS tables.
 * `bare` drops the standalone card chrome so it can sit inside the shared
 * analysis footer bar without a nested border.
 */
export function DifficultyLegend({ className, bare }: { className?: string; bare?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 max-w-full",
        bare
          ? "w-full max-sm:flex-col max-sm:items-center max-sm:gap-2"
          : "rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm w-fit max-sm:w-full max-sm:flex-col max-sm:items-center max-sm:gap-2",
        className,
      )}
      data-testid="difficulty-legend"
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          Matchup Strength
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="How matchup difficulty is calculated"
              className="grid place-items-center h-4 w-4 rounded-full bg-muted text-muted-foreground cursor-help hover:text-foreground transition-colors"
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] font-normal normal-case leading-snug text-left">
            <p className="mb-1.5">Based on opponent aFPA rank by selected position (1 = toughest D, 32 = easiest).</p>
            <ul className="space-y-0.5">
              {LEGEND_ITEMS.map(({ bucket, label, range }) => (
                <li key={bucket} className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{label}</span>
                  <span className="opacity-80">{range}</span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-x-3.5 gap-y-2 flex-wrap max-sm:w-full max-sm:justify-center">
        {LEGEND_ITEMS.map(({ bucket, label }) => (
          <span key={bucket} className="flex items-center gap-1.5 shrink-0">
            <span className={cn("h-3 w-5 rounded", getDifficultyColorClass(bucket))} aria-hidden="true" />
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 shrink-0">
          <span className={cn("h-3 w-5 rounded", getDifficultyColorClass(null, true))} aria-hidden="true" />
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Bye</span>
        </span>
      </div>
    </div>
  );
}
