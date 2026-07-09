import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SosInsightTone } from "./sos-player-insight-card";
import { useSharedFit } from "./insight-fit";

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

  // When the full team name won't fit its box, drop the city and show just the
  // nickname (the last word): "Buffalo Bills" -> "Bills". We compare the full
  // name's intrinsic width against the box and only expand back once the full
  // name fits again — that dead band keeps it from flickering at the boundary.
  const nameRef = useRef<HTMLSpanElement>(null);
  const fullNameWidthRef = useRef(0);
  const [useShortName, setUseShortName] = useState(false);
  const shortName = teamFullName?.split(" ").pop() ?? teamFullName;

  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el || !teamFullName) return;

    const measure = () => {
      if (!useShortName) fullNameWidthRef.current = el.scrollWidth;
      const available = el.clientWidth;
      if (!useShortName && el.scrollWidth > available + 1) {
        setUseShortName(true);
      } else if (useShortName && fullNameWidthRef.current && available >= fullNameWidthRef.current) {
        setUseShortName(false);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [useShortName, teamFullName]);

  // Auto-fit every single-line section that can clip on narrow cards — the
  // title, the abbreviation ⟷ aFPA stat row, and the team name ⟷ delta row.
  // Each shares a slot with the same section on the sibling cards, so they all
  // shrink together and the row stays visually consistent.
  const titleFit = useSharedFit("insight-title");
  const statFit = useSharedFit("insight-stat");
  const metaFit = useSharedFit("insight-meta");
  // The note is allowed to wrap; fit it into two lines so it never spills to a
  // third row and never has to ellipsis-truncate.
  const noteFit = useSharedFit("insight-note", { lines: 2 });

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
          {/* Row 2: full team name + delta vs league average. Auto-fit (in
              lockstep with the sibling cards) on top of the name → nickname
              fallback, so neither the name nor the delta ever clips. */}
          <div
            ref={metaFit.boxRef}
            className="relative mt-1"
            style={{ fontSize: `${8.5 * metaFit.scale}px` }}
          >
            <div className="flex w-full items-baseline gap-[0.9em]">
              {teamFullName && (
                <span ref={nameRef} className="min-w-0 flex-1 truncate font-bold text-muted-foreground">
                  {useShortName ? shortName : teamFullName}
                </span>
              )}
              <span className="shrink-0 whitespace-nowrap font-bold text-muted-foreground">{deltaText}</span>
            </div>
            {/* Invisible natural-size probe: measures the untruncated row width.
                Renders the same displayed text but carries no nameRef so the
                nickname measurement stays bound to the visible span. */}
            <div
              ref={metaFit.probeRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-baseline gap-[0.9em]"
              style={{ fontSize: "8.5px" }}
            >
              {teamFullName && (
                <span className="whitespace-nowrap font-bold text-muted-foreground">
                  {useShortName ? shortName : teamFullName}
                </span>
              )}
              <span className="whitespace-nowrap font-bold text-muted-foreground">{deltaText}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
