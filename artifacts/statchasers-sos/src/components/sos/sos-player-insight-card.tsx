import { useState } from "react";
import { cn, getPlayerProfileUrl } from "@/lib/utils";
import { useSharedFit, useSharedTruncation, MIN_SCALE } from "./insight-fit";

export type SosInsightTone = "good" | "bad" | "neutral";

export interface SosPlayerInsightCardProps {
  /** Insight headline, e.g. "Easiest Full-Season". */
  title: string;
  playerName: string;
  team: string;
  position: string;
  headshotUrl?: string | null;
  teamLogoUrl?: string | null;
  value: string | number;
  /** Unit shown after the value, e.g. "aFPA". */
  valueLabel?: string;
  /** e.g. "+1.2 vs avg". */
  deltaText: string;
  /** One short insight sentence. */
  note: string;
  tone?: SosInsightTone;
  className?: string;
  /** data-testid passthrough so cards can be targeted in tests. */
  testId?: string;
  onClick?: () => void;
}

// Tone drives the left accent bar and the small category label. Greens for
// favorable schedules, reds for brutal ones, gold (brand) for neutral. Mirrors
// the Team SOS insight card so the two tabs read as one system.
const TONE: Record<SosInsightTone, { label: string }> = {
  good: { label: "text-emerald-600" },
  bad: { label: "text-red-600" },
  neutral: { label: "text-amber-700" },
};

/**
 * Premium "player spotlight" insight card for the Player SOS tab. Shares the
 * exact design language of the Team SOS card: a small uppercase category + a
 * one-line takeaway up top, then the player's name paired with the aFPA stat and
 * a team · position ⟷ delta identity row, over a faded team-logo watermark.
 */
export function SosPlayerInsightCard({
  title,
  playerName,
  team,
  position,
  headshotUrl,
  teamLogoUrl,
  value,
  valueLabel = "aFPA",
  deltaText,
  note,
  tone = "neutral",
  className,
  testId,
  onClick,
}: SosPlayerInsightCardProps) {
  const t = TONE[tone];
  const clickable = !!onClick;
  const [imgFailed, setImgFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const showHeadshot = !!headshotUrl && !imgFailed;
  const showLogo = !!teamLogoUrl && !logoFailed;

  // Auto-fit the single-line sections that can clip on narrow cards — the title
  // and the name ⟷ aFPA stat row — plus the two-line note. Each shares a slot
  // with the same section on the sibling cards so they shrink in lockstep.
  const titleFit = useSharedFit("insight-title");
  const statFit = useSharedFit("insight-stat");
  const noteFit = useSharedFit("insight-note", { lines: 2 });
  // Once the name + aFPA row can't share a single line even at the minimum
  // auto-fit scale, every card switches to a compact layout together: the aFPA
  // value drops under the player name (so the name keeps the full width) and the
  // "team · pos" and delta identity row is dropped entirely. `factor` is
  // 1/MIN_SCALE because the row shrinks to MIN_SCALE before it would truncate.
  const compactFit = useSharedTruncation("insight-compact", { factor: 1 / MIN_SCALE });
  const compact = compactFit.hidden;

  const subName = `${team} · ${position}`;

  // The player name + aFPA value, reused verbatim in the visible (scaled) copy
  // and the invisible natural-size probes so the measurements stay identical.
  const valueBlock = (
    <div className="flex shrink-0 items-baseline gap-[0.2em]">
      <span className="font-black leading-none text-foreground">{value}</span>
      {/* normal-case so "aFPA" keeps its adjusted-FPA casing (not "AFPA"). */}
      <small className="font-black normal-case tracking-wide text-muted-foreground" style={{ fontSize: "0.553em" }}>
        {valueLabel}
      </small>
    </div>
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
        // Matches the Team SOS card: crisp border + real elevation shadow, tone
        // accent on the left, over the white page.
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

      {/* Top: small uppercase category + one-line takeaway. */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div ref={titleFit.boxRef} className="relative" style={{ fontSize: `${11 * titleFit.scale}px` }}>
            <p className={cn("truncate font-black uppercase leading-[1.2] tracking-[0.08em]", t.label)}>
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
          {/* Note: shrinks in lockstep with the siblings, with line-clamp-2 + a
              reserved two-line height as the backstop that keeps every card's
              stat block on the same baseline. */}
          <div ref={noteFit.boxRef} className="relative mt-1" style={{ fontSize: `${11 * noteFit.scale}px` }}>
            <p className="line-clamp-2 min-h-[2.6em] font-[650] leading-[1.3] text-muted-foreground">
              {note}
            </p>
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

      {/* Middle: headshot (fallback team logo), then two aligned rows — player
          name ⟷ aFPA value on the first, team · position ⟷ delta on the second. */}
      <div className="relative z-10 mt-[13px] flex items-center gap-2.5">
        {showHeadshot ? (
          <img
            src={headshotUrl!}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-9 w-9 shrink-0 rounded-full object-cover object-top bg-muted"
          />
        ) : showLogo ? (
          <img
            src={teamLogoUrl!}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setLogoFailed(true)}
            className="h-7 w-7 shrink-0 object-contain"
          />
        ) : null}
        <div ref={compactFit.boxRef} className="min-w-0 flex-1">
          {/* Row 1: player name (+ the aFPA stat, when both fit on one line).
              Auto-fits down in lockstep with the siblings; when even the
              minimum scale can't fit both, `compact` drops the aFPA from this
              row (see below) so the name gets the full width to itself. */}
          <div ref={statFit.boxRef} className="relative" style={{ fontSize: `${19.9 * statFit.scale}px` }}>
            <div className="flex w-full items-baseline justify-between gap-[0.4em]">
              <a
                href={getPlayerProfileUrl(playerName) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate font-black leading-none tracking-[0.01em] text-foreground hover:text-primary hover:underline"
                title={`View ${playerName} on StatChasers`}
              >
                {playerName}
              </a>
              {!compact && valueBlock}
            </div>
            {/* Invisible natural-size probe: measures the untruncated row width. */}
            <div
              ref={statFit.probeRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-baseline gap-[0.4em]"
              style={{ fontSize: "19.9px" }}
            >
              <span className="whitespace-nowrap font-black leading-none tracking-[0.01em] text-foreground">{playerName}</span>
              {!compact && valueBlock}
            </div>
          </div>

          {compact ? (
            /* Compact: aFPA stat restacked under the name. team · pos and the
               delta are dropped so nothing has to truncate. */
            <div className="mt-1 flex items-baseline gap-[0.2em]" style={{ fontSize: "13px" }}>
              <span className="font-black leading-none text-foreground">{value}</span>
              <small className="font-black normal-case tracking-wide text-muted-foreground" style={{ fontSize: "0.6em" }}>
                {valueLabel}
              </small>
            </div>
          ) : (
            /* Row 2: team · position + delta vs positional average. */
            <div className="mt-1 flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[8.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                {subName}
              </span>
              <p className="shrink-0 whitespace-nowrap text-[8.5px] font-bold text-muted-foreground">{deltaText}</p>
            </div>
          )}

          {/* Invisible natural-size probe for the compact detector: the full
              name + aFPA row at design size, so we know when both fit again. */}
          <div
            ref={compactFit.probeRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-baseline gap-[0.4em]"
            style={{ fontSize: "19.9px" }}
          >
            <span className="whitespace-nowrap font-black leading-none tracking-[0.01em] text-foreground">{playerName}</span>
            {valueBlock}
          </div>
        </div>
      </div>
    </article>
  );
}
