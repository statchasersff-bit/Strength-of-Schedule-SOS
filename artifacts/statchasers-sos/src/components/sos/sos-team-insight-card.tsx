import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SosInsightTone } from "./sos-player-insight-card";
import { useSharedFit, useSharedTruncation } from "./insight-fit";

export interface SosTeamInsightCardProps {
  /** Insight headline, e.g. "Easiest Full-Season Schedule". */
  title: string;
  team: string;
  /** Full team name shown under the abbreviation, e.g. "Dallas Cowboys". */
  teamFullName?: string;
  teamLogoUrl?: string | null;
  value: string | number;
  /** Unit shown after the value, e.g. "aFPA". */
  valueLabel?: string;
  /** e.g. "+1.2 vs league avg". */
  deltaText: string;
  /** One short insight sentence. */
  note: string;
  tone?: SosInsightTone;
  className?: string;
  /** data-testid passthrough so cards can be targeted in tests. */
  testId?: string;
  onClick?: () => void;
}

// Tone drives the left accent bar, the small category label and the rank chip.
// Greens for favorable schedules, reds for brutal ones, gold (brand) for neutral.
const TONE: Record<SosInsightTone, { bar: string; chip: string; label: string }> = {
  good: { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700", label: "text-emerald-600" },
  bad: { bar: "bg-red-500", chip: "bg-red-100 text-red-600", label: "text-red-600" },
  neutral: { bar: "bg-primary", chip: "bg-amber-100 text-amber-800", label: "text-amber-700" },
};

/**
 * Premium, team-branded "spotlight" insight card for the Team SOS tab: insight
 * title + one-line takeaway up top, a large team abbreviation paired with the
 * aFPA stat, a faded team-logo watermark, and the delta vs league average.
 */
export function SosTeamInsightCard({
  title,
  team,
  teamFullName,
  teamLogoUrl,
  value,
  valueLabel = "aFPA",
  deltaText,
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

  // Auto-fit every single-line section that can clip on narrow cards — the
  // title and the abbreviation ⟷ aFPA stat row. Each shares a slot with the
  // same section on the sibling cards, so they all shrink together and the row
  // stays visually consistent.
  const titleFit = useSharedFit("insight-title");
  const statFit = useSharedFit("insight-stat");
  // The note is allowed to wrap; fit it into two lines so it never spills to a
  // third row and never has to ellipsis-truncate.
  const noteFit = useSharedFit("insight-note", { lines: 2 });
  // The team name is dropped from *every* card the moment it would truncate on
  // any one of them, so the name/delta row stays uniform across the row.
  const nameFit = useSharedTruncation("insight-name");
  // Likewise, once the full "… vs league avg" delta no longer fits on one line
  // (so its right edge would stop aligning with the aFPA value above), every
  // card drops the word "league" together: "… vs league avg" -> "… vs avg".
  const deltaFit = useSharedTruncation("insight-delta");
  const shortDelta = deltaText.replace("league ", "");
  const displayedDelta = deltaFit.hidden ? shortDelta : deltaText;

  // Both detectors measure against the same row width, so their box refs point
  // at the same element.
  const setRowRef = (el: HTMLDivElement | null) => {
    nameFit.boxRef.current = el;
    deltaFit.boxRef.current = el;
  };

  // Reused in both the visible (scaled) copy and the invisible natural-size
  // probe so the two are guaranteed identical. Sizes are em-relative to the
  // stat row's design size (19.9px) so they scale as one unit.
  const statItems = (
    <>
      <span className="font-black leading-none tracking-[0.02em] text-foreground">{team}</span>
      <div className="flex shrink-0 items-baseline gap-[0.2em]">
        <span className="font-black leading-none text-foreground">{value}</span>
        {/* normal-case so "aFPA" keeps its adjusted-FPA casing (not "AFPA"). */}
        <small className="font-black normal-case tracking-wide text-muted-foreground" style={{ fontSize: "0.553em" }}>
          {valueLabel}
        </small>
      </div>
    </>
  );

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
        "group relative flex min-h-[117px] flex-col overflow-hidden rounded-[18px] border border-l-4 border-[rgba(11,31,58,0.14)] bg-card px-[18px] py-[10px] shadow-[0_1px_2px_rgba(11,31,58,0.06),0_8px_24px_-8px_rgba(11,31,58,0.14)] transition-all duration-150",
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

      {/* Top: small uppercase category + one-line takeaway, so the team + aFPA
          below read as the heroes rather than competing with a big title. */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div ref={titleFit.boxRef} className="relative" style={{ fontSize: `${11 * titleFit.scale}px` }}>
            <p
              className={cn("truncate font-black uppercase leading-[1.2] tracking-[0.08em]", t.label)}
            >
              {title}
            </p>
            {/* Invisible natural-size probe: measures the untruncated title width. */}
            <p
              ref={titleFit.probeRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 w-max whitespace-nowrap font-black uppercase leading-[1.2] tracking-[0.08em]"
              style={{ fontSize: "11px" }}
            >
              {title}
            </p>
          </div>
          {/* Fit the note into two lines: it shrinks (in lockstep with the
              sibling cards) so it never spills to a third row, with line-clamp-2
              + a reserved two-line height as the backstop that also keeps every
              card's stat block on the same baseline. */}
          <div ref={noteFit.boxRef} className="relative mt-1" style={{ fontSize: `${11 * noteFit.scale}px` }}>
            <p
              className="line-clamp-2 min-h-[2.6em] font-[650] leading-[1.3] text-muted-foreground"
            >
              {note}
            </p>
            {/* Invisible single-line probe: measures the note's full length. */}
            <p
              ref={noteFit.probeRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 w-max whitespace-nowrap font-[650] leading-[1.3] text-muted-foreground"
              style={{ fontSize: "11px" }}
            >
              {note}
            </p>
          </div>
        </div>
      </div>

      {/* Middle: logo, then two aligned rows — abbreviation ⟷ aFPA value share
          the first row (same baseline), full team name ⟷ delta the second.
          Extra top margin pushes this block down (~20% of the card height),
          absorbing the slack that was sitting below it so the card keeps its size. */}
      <div className="relative z-10 mt-[13px] flex items-center gap-2.5">
        {showLogo && (
          <img
            src={teamLogoUrl!}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setLogoFailed(true)}
            className="h-7 w-7 shrink-0 object-contain"
          />
        )}
        <div className="min-w-0 flex-1">
          {/* Row 1: team abbreviation + aFPA stat, aligned on one baseline.
              Auto-fit down (in lockstep with the sibling cards) so long values
              never clip on narrow cards. */}
          <div ref={statFit.boxRef} className="relative" style={{ fontSize: `${19.9 * statFit.scale}px` }}>
            <div className="flex w-full items-baseline justify-between gap-[0.4em]">{statItems}</div>
            {/* Invisible natural-size probe: measures the untruncated stat width. */}
            <div
              ref={statFit.probeRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-baseline gap-[0.4em]"
              style={{ fontSize: "19.9px" }}
            >
              {statItems}
            </div>
          </div>
          {/* Row 2: full team name + delta vs league average. The name is
              dropped from every card at once (nameFit.hidden) the moment it
              would truncate on any one of them, so the row stays uniform;
              the delta always stays, right-aligned under the aFPA value, and
              drops "league" once the full form would overflow (deltaFit). */}
          <div ref={setRowRef} className="relative mt-1 flex items-baseline gap-2">
            {teamFullName && !nameFit.hidden && (
              <span className="min-w-0 flex-1 truncate text-[8.5px] font-bold text-muted-foreground">
                {teamFullName}
              </span>
            )}
            <p
              className={cn(
                "shrink-0 whitespace-nowrap text-[8.5px] font-bold text-muted-foreground",
                (nameFit.hidden || !teamFullName) && "ml-auto",
              )}
            >
              {displayedDelta}
            </p>
            {/* Invisible natural-size probe: full name + the *displayed* delta,
                so the row can tell when the name would truncate — even while the
                name is hidden, so it can be restored when space grows. */}
            {teamFullName && (
              <div
                ref={nameFit.probeRef}
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-baseline gap-2 text-[8.5px] font-bold"
              >
                <span className="whitespace-nowrap">{teamFullName}</span>
                <span className="whitespace-nowrap">{displayedDelta}</span>
              </div>
            )}
            {/* Invisible probe of the *full* delta, so the row can tell when
                "… vs league avg" would overflow and needs shortening. */}
            <div
              ref={deltaFit.probeRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 w-max whitespace-nowrap text-[8.5px] font-bold"
            >
              {deltaText}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
