import { FilterState } from "@/hooks/use-filters";
import {
  useGetTeamSos,
  getGetTeamSosQueryKey,
  useGetPlayerSos,
  getGetPlayerSosQueryKey,
} from "@/lib/sos-client";
import { cn, getTeamLogoUrl } from "@/lib/utils";
import type { SortDir } from "./sortable";
import { SosPlayerInsightCard, type SosInsightTone } from "./sos-player-insight-card";
import { SosTeamInsightCard } from "./sos-team-insight-card";
import { InsightFitProvider } from "./insight-fit";

/** Emitted when a card is clicked — tells the table how to focus the pick. */
export interface CardFocus {
  /** Column key to sort by (matches the matrix accessors). */
  sortKey: string;
  dir: SortDir;
  /** data-testid of the row to highlight + scroll to. */
  testId: string;
  /** Bumped on every click so repeat clicks re-trigger the effect. */
  nonce: number;
}

interface InsightCardsProps {
  filters: FilterState;
  activeTab: string;
  onSelect?: (focus: Omit<CardFocus, "nonce">) => void;
}

/** Human-readable scoring label for the card context line. */
function scoringLabel(scoring: string): string {
  if (scoring === "HALF_PPR") return "Half-PPR";
  if (scoring === "STD" || scoring === "STANDARD") return "Standard";
  return scoring.replace("_", " ");
}

interface WeekCellLike {
  week: number;
  isBye: boolean;
  adjustedPoints?: number | null;
}
interface SosRowLike {
  team: string;
  teamFullName?: string;
  playerId?: string;
  playerName?: string;
  headshotUrl?: string | null;
  weeks: WeekCellLike[];
  playoff3?: { adjustedPoints?: number | null } | null;
}

interface Card {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  /** Full team name for the Team SOS cards, e.g. "Dallas Cowboys". */
  teamFullName: string;
  /** aFPA number, already rounded, as a string. */
  detail: string;
  /** e.g. "+1.8 vs league avg". */
  deltaText: string;
  /** One-line plain-language summary of the insight. */
  note: string;
  trend: "positive" | "negative";
  /** Player headshot for the Player SOS view; null for teams / missing images. */
  imageUrl: string | null;
  focus: Omit<CardFocus, "nonce">;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const signed = (x: number) => `${x > 0 ? "+" : ""}${round1(x)}`;

/** Mean opponent aFPA over the fantasy regular season (weeks 1-17). */
function fullSeasonAvg(row: SosRowLike): number | null {
  const vals = row.weeks
    .filter((c) => c.week <= 17 && !c.isBye && c.adjustedPoints != null)
    .map((c) => c.adjustedPoints as number);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Mean opponent aFPA across the fantasy playoffs (weeks 15-17). */
function playoffAvg(row: SosRowLike): number | null {
  return row.playoff3?.adjustedPoints ?? null;
}

function extremes(rows: SosRowLike[], metric: (r: SosRowLike) => number | null) {
  const scored = rows
    .map((r) => ({ r, v: metric(r) }))
    .filter((x): x is { r: SosRowLike; v: number } => x.v != null);
  if (!scored.length) return null;
  // Higher avg opponent aFPA = more points allowed = easier schedule.
  const easiest = scored.reduce((a, b) => (b.v > a.v ? b : a));
  const toughest = scored.reduce((a, b) => (b.v < a.v ? b : a));
  const mean = scored.reduce((a, b) => a + b.v, 0) / scored.length;
  return { easiest, toughest, mean };
}

function buildCards(rows: SosRowLike[], isPlayer: boolean, filters: FilterState): Card[] {
  const label = (r: SosRowLike) => (isPlayer ? r.playerName ?? r.team : r.team);
  const fullName = (r: SosRowLike) => r.teamFullName ?? r.team;
  // Player headshot only — team cards don't carry an image.
  const image = (r: SosRowLike) => (isPlayer ? r.headshotUrl ?? null : null);
  const pos = filters.position;
  // Context line spells out exactly what the number reflects: position,
  // scoring format and week range — plus the team for the player view.
  const context = `${pos} · ${scoringLabel(filters.scoring)}`;
  const sub = (weeks: string, r: SosRowLike) =>
    isPlayer ? `${context} · ${weeks} · ${r.team}` : `${context} · ${weeks}`;
  // The table row a card jumps to when clicked.
  const testId = (r: SosRowLike) =>
    isPlayer ? `player-row-${r.playerId ?? ""}` : `team-row-${r.team}`;

  const full = extremes(rows, fullSeasonAvg);
  const po = extremes(rows, playoffAvg) ?? full;
  if (!full) return [];

  return [
    {
      id: "easiest-schedule",
      title: "Easiest Full-Season",
      subtitle: sub("Weeks 1-17", full.easiest.r),
      value: label(full.easiest.r),
      teamFullName: fullName(full.easiest.r),
      detail: `${round1(full.easiest.v)}`,
      deltaText: `${signed(full.easiest.v - full.mean)} vs league avg`,
      note: `Best ${pos} schedule by opponent aFPA.`,
      trend: "positive",
      imageUrl: image(full.easiest.r),
      focus: { sortKey: "ovr", dir: "asc", testId: testId(full.easiest.r) },
    },
    {
      id: "toughest-schedule",
      title: "Toughest Full-Season",
      subtitle: sub("Weeks 1-17", full.toughest.r),
      value: label(full.toughest.r),
      teamFullName: fullName(full.toughest.r),
      detail: `${round1(full.toughest.v)}`,
      deltaText: `${signed(full.toughest.v - full.mean)} vs league avg`,
      note: `Worst ${pos} schedule by opponent aFPA.`,
      trend: "negative",
      imageUrl: image(full.toughest.r),
      focus: { sortKey: "ovr", dir: "desc", testId: testId(full.toughest.r) },
    },
    {
      id: "best-playoff",
      title: "Easiest Playoff",
      subtitle: sub("Weeks 15-17", po!.easiest.r),
      value: label(po!.easiest.r),
      teamFullName: fullName(po!.easiest.r),
      detail: `${round1(po!.easiest.v)}`,
      deltaText: `${signed(po!.easiest.v - po!.mean)} vs league avg`,
      note: `Best ${pos} playoff schedule by opponent aFPA.`,
      trend: "positive",
      imageUrl: image(po!.easiest.r),
      focus: { sortKey: "playoff", dir: "asc", testId: testId(po!.easiest.r) },
    },
    {
      id: "toughest-playoff",
      title: "Toughest Playoff",
      subtitle: sub("Weeks 15-17", po!.toughest.r),
      value: label(po!.toughest.r),
      teamFullName: fullName(po!.toughest.r),
      detail: `${round1(po!.toughest.v)}`,
      deltaText: `${signed(po!.toughest.v - po!.mean)} vs league avg`,
      note: `Worst ${pos} playoff schedule by opponent aFPA.`,
      trend: "negative",
      imageUrl: image(po!.toughest.r),
      focus: { sortKey: "playoff", dir: "desc", testId: testId(po!.toughest.r) },
    },
  ];
}

/** Data for the premium player spotlight cards shown on the Player SOS tab. */
interface PlayerInsightCard {
  id: string;
  label: string;
  playerName: string;
  team: string;
  position: string;
  headshotUrl: string | null;
  value: string;
  valueLabel: string;
  /** Secondary context line, e.g. "+1.2 vs avg". */
  deltaText: string;
  tone: SosInsightTone;
  focus: Omit<CardFocus, "nonce">;
}

function buildPlayerInsightCards(rows: SosRowLike[], filters: FilterState): PlayerInsightCard[] {
  const pos = filters.position;
  const full = extremes(rows, fullSeasonAvg);
  const po = extremes(rows, playoffAvg) ?? full;
  if (!full) return [];

  type Scored = { r: SosRowLike; v: number };
  // Labels are kept short on purpose — the card context already implies SOS, so
  // long labels only cause awkward wrapping.
  const make = (
    id: string,
    label: string,
    x: Scored,
    mean: number,
    tone: SosInsightTone,
    sortKey: string,
    dir: SortDir,
  ): PlayerInsightCard => ({
    id,
    label,
    playerName: x.r.playerName ?? x.r.team,
    team: x.r.team,
    position: pos,
    headshotUrl: x.r.headshotUrl ?? null,
    value: `${round1(x.v)}`,
    valueLabel: "aFPA",
    deltaText: `${signed(x.v - mean)} vs avg`,
    tone,
    focus: { sortKey, dir, testId: `player-row-${x.r.playerId ?? ""}` },
  });

  return [
    make("best-full", "Easiest Full Season", full.easiest, full.mean, "good", "ovr", "asc"),
    make("toughest-full", "Toughest Full Season", full.toughest, full.mean, "bad", "ovr", "desc"),
    make("best-playoff", "Easiest Playoffs", po!.easiest, po!.mean, "good", "playoff", "asc"),
    make("toughest-playoff", "Toughest Playoffs", po!.toughest, po!.mean, "bad", "playoff", "desc"),
  ];
}

export function InsightCards({ filters, activeTab, onSelect }: InsightCardsProps) {
  const isPlayer = activeTab === "player";

  // The cards mirror whichever dataset the active tab shows, so they react to
  // position, scoring and the Team/Player toggle. Both hooks are declared
  // (rules of hooks) but only the active one fetches.
  const teamQuery = useGetTeamSos(filters, {
    query: {
      enabled: !!filters.season && !isPlayer,
      queryKey: getGetTeamSosQueryKey(filters),
    },
  });
  const playerQuery = useGetPlayerSos(filters, {
    query: {
      enabled: !!filters.season && isPlayer,
      queryKey: getGetPlayerSosQueryKey(filters),
    },
  });

  const isLoading = isPlayer ? playerQuery.isLoading : teamQuery.isLoading;
  const rows = (isPlayer ? playerQuery.data?.rows : teamQuery.data?.rows) as
    | SosRowLike[]
    | undefined;

  // Team KPI cards: stay 4-up in a single row from the md breakpoint on; below
  // that (large phones / small tablets) collapse to 2x2, where the cards are
  // roomier than a cramped 4-up row would be.
  const teamContainerClass =
    "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8";
  // Player spotlight cards need room to breathe: never force 4 across unless the
  // screen is wide. Phones snap-scroll (cards ≥310px); tablet/small-desktop show
  // 2-up; only xl (≥1280px) goes 4-up.
  const playerContainerClass =
    "flex sm:grid sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6 md:mb-8 overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-[10px] px-[10px] sm:mx-0 sm:px-0 pb-2 sm:pb-0";
  const playerCardSizing = "min-w-[310px] snap-start shrink-0 sm:min-w-0 sm:shrink";

  if (isLoading) {
    const containerClass = isPlayer ? playerContainerClass : teamContainerClass;
    return (
      <div className={containerClass}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "bg-card rounded-2xl border border-border animate-pulse border-l-4 border-l-primary/50",
              isPlayer ? cn(playerCardSizing, "min-h-[178px] rounded-[18px]") : "h-[117px]",
            )}
          />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) return null;

  // Player SOS tab → premium player spotlight cards.
  if (isPlayer) {
    const playerCards = buildPlayerInsightCards(rows, filters);
    if (playerCards.length === 0) return null;
    return (
      <div className={playerContainerClass}>
        {playerCards.map((card) => (
          <SosPlayerInsightCard
            key={card.id}
            testId={`card-insight-${card.id}`}
            className={playerCardSizing}
            label={card.label}
            playerName={card.playerName}
            team={card.team}
            position={card.position}
            headshotUrl={card.headshotUrl}
            teamLogoUrl={getTeamLogoUrl(card.team)}
            value={card.value}
            valueLabel={card.valueLabel}
            deltaText={card.deltaText}
            tone={card.tone}
            onClick={onSelect ? () => onSelect(card.focus) : undefined}
          />
        ))}
      </div>
    );
  }

  // Team SOS tab → premium, team-branded spotlight cards.
  const cards = buildCards(rows, isPlayer, filters);
  if (cards.length === 0) return null;

  return (
    <InsightFitProvider>
      <div className={teamContainerClass}>
        {cards.map((card) => (
          <SosTeamInsightCard
          key={card.id}
          testId={`card-insight-${card.id}`}
          title={card.title}
          team={card.value}
          teamFullName={card.teamFullName}
          teamLogoUrl={getTeamLogoUrl(card.value)}
          value={card.detail}
          valueLabel="aFPA"
          deltaText={card.deltaText}
          note={card.note}
          tone={card.trend === "positive" ? "good" : "bad"}
          onClick={onSelect ? () => onSelect(card.focus) : undefined}
          />
        ))}
      </div>
    </InsightFitProvider>
  );
}
