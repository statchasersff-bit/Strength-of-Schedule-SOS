import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SosInsightTone } from "./sos-player-insight-card";

export interface SosTeamInsightCardProps {
  /** Insight headline, e.g. "Easiest Full-Season Schedule". */
  title: string;
  /** Rank chip text, e.g. "#1 Easiest". */
  rankLabel: string;
  team: string;
  teamLogoUrl?: string | null;
  value: string | number;
  /** Unit shown after the value, e.g. "aFPA". */
  valueLabel?: string;
  /** e.g. "+1.2 vs league avg". */
  deltaText: string;
  /** Compact filter chips: position, scoring, week range. */
  chips: string[];
  /** One short insight sentence. */
  note: string;
  tone?: SosInsightTone;
  className?: string;
  /** data-testid passthrough so cards can be targeted in tests. */
  testId?: string;
  onClick?: () => void;
}

// Tone drives the left accent bar and the filled rank chip. Greens for
// favorable schedules, reds for brutal ones, gold (brand) for neutral.
const TONE: Record<SosInsightTone, { bar: string; chip: string }> = {
  good: { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  bad: { bar: "bg-red-500", chip: "bg-red-100 text-red-600" },
  neutral: { bar: "bg-primary", chip: "bg-amber-100 text-amber-800" },
};

/**
 * Premium, team-branded "spotlight" insight card for the Team SOS tab: insight
 * title + rank chip up top, a large team abbreviation paired with the aFPA stat,
 * a faded team-logo watermark, and compact filter chips with a one-line takeaway.
 */
export function SosTeamInsightCard({
  title,
  rankLabel,
  team,
  teamLogoUrl,
  value,
  valueLabel = "aFPA",
  deltaText,
  chips,
  note,
  tone = "neutral",
  className,
  testId,
  onClick,
}: SosTeamInsightCardProps) {
  const t = TONE[tone];
  const clickable = !!onClick;
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = !!teamLogoUrl && !logoFailed;

  return (
    <article
      data-testid={testId}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
      className={cn(
        // A crisper border + real elevation shadow so each card reads as a
        // distinct container against the white page (white card on white bg
        // otherwise looks like floating text with a barely-visible edge).
        "group relative flex min-h-[180px] flex-col overflow-hidden rounded-[18px] border border-l-4 border-[rgba(11,31,58,0.14)] bg-card p-[18px] shadow-[0_1px_2px_rgba(11,31,58,0.06),0_8px_24px_-8px_rgba(11,31,58,0.14)] transition-all duration-150",
        tone === "good" && "border-l-emerald-500",
        tone === "bad" && "border-l-red-500",
        tone === "neutral" && "border-l-primary",
        clickable &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        className,
      )}
    >
      {/* Subtle brand glow, top-right. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-primary/10 blur-2xl"
      />
      {/* Faded team-logo watermark, bottom-right. */}
      {showLogo && (
        <img
          src={teamLogoUrl!}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={() => setLogoFailed(true)}
          className="pointer-events-none absolute -bottom-4 -right-3 z-0 h-28 w-28 object-contain opacity-[0.08] transition-opacity duration-150 group-hover:opacity-[0.13]"
        />
      )}

      {/* Top: title + rank chip. */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <p className="text-[13px] md:text-sm font-black leading-[1.15] tracking-[-0.01em] text-foreground">
          {title}
        </p>
        <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.05em]", t.chip)}>
          {rankLabel}
        </span>
      </div>

      {/* Middle: team abbreviation hero + aFPA stat. */}
      <div className="relative z-10 mt-5 flex items-end justify-between gap-3">
        <span className="text-[34px] font-black leading-none tracking-[0.02em] text-foreground">{team}</span>
        <div className="text-right">
          <span className="block text-2xl font-black leading-none text-foreground">{value}</span>
          <small className="mt-1 block text-[11px] font-black uppercase tracking-wide text-muted-foreground">{valueLabel}</small>
        </div>
      </div>

      {/* Delta vs league average. */}
      <p className="relative z-10 mt-2 text-xs font-bold text-muted-foreground">{deltaText}</p>

      {/* Bottom: compact filter chips + one-line takeaway. */}
      <div className="relative z-10 mt-auto pt-3.5">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-muted px-2 py-1 text-[10px] font-black uppercase tracking-[0.04em] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-xs font-[650] leading-[1.35] text-muted-foreground">{note}</p>
      </div>
    </article>
  );
}
