import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * How the SOS model weights prior-season vs current-season data through the
 * year. Shown when the current season hasn't accumulated a reliable sample yet,
 * so users understand the numbers are baseline-driven. Keep the phases in sync
 * with the blending logic in scripts/src/sos-lib.ts.
 */
const PHASES: { when: string; what: string }[] = [
  { when: "Preseason", what: "100% 2025 full season" },
  { when: "Weeks 1–4", what: "Blended baseline and 2026 data" },
  { when: "Week 5+", what: "Mostly current-season data" },
  { when: "Week 12+", what: "Rolling 10-week data" },
];

/** Badge + dropdown explaining the preseason baseline blending schedule. */
export function BaselineNotice({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="baseline-notice-trigger"
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
            className,
          )}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          Preseason Baseline Active
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80" data-testid="baseline-notice-content">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Preseason Baseline Active</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Using 2025 full-season data until 2026 sample sizes become reliable.
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {PHASES.map(({ when, what }) => (
            <li key={when} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="shrink-0 font-bold text-foreground">{when}</span>
              <span className="text-right text-muted-foreground">{what}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
