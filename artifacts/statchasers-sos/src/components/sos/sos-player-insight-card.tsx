import { useState } from "react";
import { cn } from "@/lib/utils";

export type SosInsightTone = "good" | "bad" | "neutral";

export interface SosPlayerInsightCardProps {
  /** Short uppercase insight headline, e.g. "BEST PLAYOFF". */
  label: string;
  playerName: string;
  team: string;
  position: string;
  headshotUrl?: string | null;
  teamLogoUrl?: string | null;
  /** Optional compact filter chips under the name: position, scoring, week range. */
  chips?: string[];
  value: string | number;
  /** Unit shown after the value, e.g. "aFPA". */
  valueLabel?: string;
  /** Optional secondary line under the pill, e.g. "+1.2 vs avg". */
  deltaText?: string;
  tone?: SosInsightTone;
  className?: string;
  /** data-testid passthrough so cards can be targeted in tests. */
  testId?: string;
  onClick?: () => void;
}

// Tone drives the left accent bar and the filled stat chip. Greens for
// favorable schedules, reds for brutal ones, gold (brand) for neutral.
const TONE: Record<SosInsightTone, { bar: string; chip: string }> = {
  good: { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  bad: { bar: "bg-red-500", chip: "bg-red-100 text-red-600" },
  neutral: { bar: "bg-primary", chip: "bg-amber-100 text-amber-800" },
};

/**
 * Premium "player spotlight" insight card: headshot cutout on a diagonal panel
 * to the left, insight label + player name + stat chip on the right, with the
 * team logo tucked into the top-right corner. Built for the Player SOS tab.
 */
export function SosPlayerInsightCard({
  label,
  playerName,
  team,
  headshotUrl,
  teamLogoUrl,
  chips,
  value,
  valueLabel,
  deltaText,
  tone = "neutral",
  className,
  testId,
  onClick,
}: SosPlayerInsightCardProps) {
  const t = TONE[tone];
  const clickable = !!onClick;
  // Fall back to the dark team-abbreviation badge when the headshot is missing
  // or fails to load.
  const [imgFailed, setImgFailed] = useState(false);
  const showHeadshot = !!headshotUrl && !imgFailed;
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
        // No fixed card height: the card sizes to its content so the headshot can
        // keep its natural proportions as the layout narrows.
        // Crisper border + real elevation shadow so each card reads as a
        // distinct container against the white page (mirrors the Team SOS cards).
        "group relative grid grid-cols-[40%_60%] overflow-hidden rounded-[18px] border border-[rgba(11,31,58,0.14)] bg-card shadow-[0_1px_2px_rgba(11,31,58,0.06),0_8px_24px_-8px_rgba(11,31,58,0.14)] transition-all duration-150",
        clickable &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        className,
      )}
    >
      {/* Tone accent bar. */}
      <span className={cn("absolute left-0 top-0 bottom-0 z-30 w-1", t.bar)} aria-hidden="true" />

      {/* Media panel: soft diagonal brand shape + headshot anchored bottom-center.
          A min height keeps the panel from collapsing; it grows with the content. */}
      <div className="relative min-h-[150px] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            clipPath: "polygon(0 0, 100% 0, 76% 100%, 0 100%)",
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.16), transparent 45%), linear-gradient(145deg, hsl(var(--muted)) 0%, hsl(var(--card)) 70%)",
          }}
        />
        {showHeadshot ? (
          <img
            src={headshotUrl!}
            alt={playerName}
            loading="lazy"
            onError={() => setImgFailed(true)}
            // Every headshot fills the exact same portrait zone: object-contain
            // keeps the aspect ratio while object-bottom pins the shoulder
            // baseline to the bottom edge, so heads and footprints line up
            // card-to-card regardless of how the source image was cropped.
            className="absolute inset-0 z-10 h-full w-full object-contain object-bottom drop-shadow-sm"
          />
        ) : (
          <div className="absolute bottom-4 left-1/2 z-10 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full bg-foreground text-base font-black uppercase text-primary">
            {team}
          </div>
        )}
      </div>

      {/* Faded team-logo watermark, bottom-right (mirrors the Team SOS cards). */}
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

      {/* Content panel. */}
      <div className="relative z-10 flex min-w-0 flex-col p-[18px]">
        <p className="text-[11px] font-black uppercase leading-[1.15] tracking-[0.08em] text-[#17457a]">
          {label}
        </p>

        {/* Player name is the hero: heavier weight and a two-line clamp so long
            hyphenated names (Amon-Ra St. Brown, Jaxon Smith-Njigba) wrap rather
            than truncate. The reserved min-height keeps every card aligned; we
            never shrink the font per player. */}
        <h3 className="mt-2 text-[22px] font-[850] leading-[1.08] tracking-[-0.025em] text-foreground line-clamp-2 min-h-[48px]">
          {playerName}
        </h3>

        {/* aFPA stat pill + optional delta vs positional average, just below the name. */}
        <div className="mt-2">
          <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-black", t.chip)}>
            {value}
            {valueLabel ? <span className="ml-1 font-bold opacity-80">{valueLabel}</span> : null}
          </span>
          {deltaText ? (
            <span className="mt-1 block text-[10px] font-bold text-muted-foreground">{deltaText}</span>
          ) : null}
        </div>

        {/* Compact filter chips — mirrors the Team SOS insight cards. Pinned to
            the bottom so every card aligns. Omitted when no chips are supplied. */}
        {chips && chips.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3.5">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-muted px-2 py-1 text-[10px] font-black uppercase tracking-[0.04em] text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
