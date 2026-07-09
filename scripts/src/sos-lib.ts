/**
 * Shared helpers for the StatChasers SOS data pipeline.
 *
 * The pipeline is two stages:
 *   1. fpa-ingest.ts  — the canonical aFPA calculator. Reads nflverse weekly
 *      player stats, computes opponent-adjusted fantasy-points-allowed per
 *      (defense, position, scoring), and writes an FPA *snapshot* per season +
 *      scoring format.
 *   2. build-sos.ts   — consumes the snapshot (never recomputes aFPA) and maps
 *      each team's 2026 schedule onto the opponent defense's position-specific
 *      aFPA rank to produce the team / player SOS matrices the frontend reads.
 *
 * All data comes from nflverse released CSVs (no Python / nflreadpy needed).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// this file lives at <repo>/scripts/src/sos-lib.ts
const REPO_ROOT = join(__dirname, "..", "..");

/** Where the frontend reads its static JSON from (Vite serves /data/sos/...). */
export const DATA_DIR = join(
  REPO_ROOT,
  "artifacts",
  "statchasers-sos",
  "public",
  "data",
  "sos",
);

/** Intermediate FPA snapshots produced by fpa-ingest, consumed by build-sos. */
export const SNAPSHOT_DIR = process.env.SOS_SNAPSHOT_DIR
  ? process.env.SOS_SNAPSHOT_DIR
  : join(REPO_ROOT, "data", "fpa-snapshots");

export const SEASON = Number(process.env.SOS_SEASON ?? "2026");
export const BASELINE_SEASONS = (process.env.SOS_BASELINE_SEASONS ?? "2025")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));

export const POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export type Position = (typeof POSITIONS)[number];

/** scoring key -> { per-reception points, filename slug }. */
export const SCORINGS: Record<string, { recPts: number; slug: string }> = {
  PPR: { recPts: 1.0, slug: "ppr" },
  HALF_PPR: { recPts: 0.5, slug: "half-ppr" },
  STANDARD: { recPts: 0.0, slug: "std" },
};

export const REGULAR_SEASON_WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
export const FANTASY_PLAYOFF_WEEKS = [15, 16, 17];
/** Fantasy ROS / playoffs exclude Week 18 (NFL week 18 isn't a fantasy week). */
export const FANTASY_LAST_WEEK = 17;
/** Weeks shown in Team / Player SOS (fantasy season, Week 18 excluded). */
export const FANTASY_WEEKS = REGULAR_SEASON_WEEKS.filter((w) => w <= FANTASY_LAST_WEEK);
export const PLAYERS_PER_POSITION = 40;

// nflverse released CSV assets.
export const SCHEDULE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";
export const playerStatsUrl = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;
export const rosterUrl = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_${season}.csv`;

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export const TEAM_META: Record<string, { name: string; division: string }> = {
  ARI: { name: "Arizona Cardinals", division: "NFC West" },
  ATL: { name: "Atlanta Falcons", division: "NFC South" },
  BAL: { name: "Baltimore Ravens", division: "AFC North" },
  BUF: { name: "Buffalo Bills", division: "AFC East" },
  CAR: { name: "Carolina Panthers", division: "NFC South" },
  CHI: { name: "Chicago Bears", division: "NFC North" },
  CIN: { name: "Cincinnati Bengals", division: "AFC North" },
  CLE: { name: "Cleveland Browns", division: "AFC North" },
  DAL: { name: "Dallas Cowboys", division: "NFC East" },
  DEN: { name: "Denver Broncos", division: "AFC West" },
  DET: { name: "Detroit Lions", division: "NFC North" },
  GB: { name: "Green Bay Packers", division: "NFC North" },
  HOU: { name: "Houston Texans", division: "AFC South" },
  IND: { name: "Indianapolis Colts", division: "AFC South" },
  JAX: { name: "Jacksonville Jaguars", division: "AFC South" },
  KC: { name: "Kansas City Chiefs", division: "AFC West" },
  LV: { name: "Las Vegas Raiders", division: "AFC West" },
  LAC: { name: "Los Angeles Chargers", division: "AFC West" },
  LAR: { name: "Los Angeles Rams", division: "NFC West" },
  MIA: { name: "Miami Dolphins", division: "AFC East" },
  MIN: { name: "Minnesota Vikings", division: "NFC North" },
  NE: { name: "New England Patriots", division: "AFC East" },
  NO: { name: "New Orleans Saints", division: "NFC South" },
  NYG: { name: "New York Giants", division: "NFC East" },
  NYJ: { name: "New York Jets", division: "AFC East" },
  PHI: { name: "Philadelphia Eagles", division: "NFC East" },
  PIT: { name: "Pittsburgh Steelers", division: "AFC North" },
  SF: { name: "San Francisco 49ers", division: "NFC West" },
  SEA: { name: "Seattle Seahawks", division: "NFC West" },
  TB: { name: "Tampa Bay Buccaneers", division: "NFC South" },
  TEN: { name: "Tennessee Titans", division: "AFC South" },
  WAS: { name: "Washington Commanders", division: "NFC East" },
};

export const TEAM_ABBRS = Object.keys(TEAM_META);

const TEAM_ALIASES: Record<string, string> = {
  JAC: "JAX",
  LA: "LAR",
  STL: "LAR",
  SD: "LAC",
  OAK: "LV",
  WSH: "WAS",
  GNB: "GB",
  KAN: "KC",
  NWE: "NE",
  NOR: "NO",
  SFO: "SF",
  TAM: "TB",
  LVR: "LV",
};

export function normTeam(abbr: unknown): string | null {
  if (abbr == null) return null;
  let a = String(abbr).trim().toUpperCase();
  a = TEAM_ALIASES[a] ?? a;
  return a in TEAM_META ? a : null;
}

export function positionGroup(pos: unknown): Position | null {
  if (pos == null) return null;
  const p = String(pos).trim().toUpperCase();
  if (p === "QB") return "QB";
  if (p === "RB" || p === "FB" || p === "HB") return "RB";
  if (p === "WR") return "WR";
  if (p === "TE") return "TE";
  return null;
}

// ---------------------------------------------------------------------------
// Difficulty buckets — fixed rank thresholds (rank 1 = toughest defense).
// ---------------------------------------------------------------------------

export type Bucket =
  | "VERY_TOUGH"
  | "TOUGH"
  | "NEUTRAL"
  | "FAVORABLE"
  | "SMASH_SPOT";

export function bucketFromRank(rank: number): Bucket {
  if (rank <= 5) return "VERY_TOUGH";
  if (rank <= 10) return "TOUGH";
  if (rank <= 22) return "NEUTRAL";
  if (rank <= 27) return "FAVORABLE";
  return "SMASH_SPOT";
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Minimal RFC-4180-ish parser: handles quoted fields with embedded commas. */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parse a CSV into row objects keyed only by the columns requested. */
export async function fetchCsvRows(
  url: string,
  columns: string[],
): Promise<Record<string, string>[]> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const { header, rows } = parseCsv(await res.text());
  const idx: Record<string, number> = {};
  for (const col of columns) {
    const i = header.indexOf(col);
    if (i >= 0) idx[col] = i;
  }
  return rows.map((cols) => {
    const obj: Record<string, string> = {};
    for (const col of Object.keys(idx)) obj[col] = cols[idx[col]] ?? "";
    return obj;
  });
}

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** First present, non-empty column among names -> numeric value. */
export function firstNum(row: Record<string, string>, ...names: string[]): number {
  for (const n of names) {
    if (n in row && row[n] !== "") return num(row[n]);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Fantasy points
// ---------------------------------------------------------------------------

/**
 * Standard fantasy scoring for one weekly player-stats row.
 * Interceptions are -1 (StatChasers house rule).
 */
export function fantasyPoints(
  row: Record<string, string>,
  recPts: number,
): number {
  const passYds = firstNum(row, "passing_yards");
  const passTd = firstNum(row, "passing_tds");
  const ints = firstNum(row, "passing_interceptions", "interceptions");
  const rushYds = firstNum(row, "rushing_yards");
  const rushTd = firstNum(row, "rushing_tds");
  const rec = firstNum(row, "receptions");
  const recYds = firstNum(row, "receiving_yards");
  const recTd = firstNum(row, "receiving_tds");
  const fumblesLost =
    firstNum(row, "rushing_fumbles_lost") +
    firstNum(row, "receiving_fumbles_lost") +
    firstNum(row, "sack_fumbles_lost");
  const twoPt =
    firstNum(row, "passing_2pt_conversions") +
    firstNum(row, "rushing_2pt_conversions") +
    firstNum(row, "receiving_2pt_conversions");

  return (
    passYds * 0.04 +
    passTd * 4.0 -
    ints * 1.0 +
    rushYds * 0.1 +
    rushTd * 6.0 +
    rec * recPts +
    recYds * 0.1 +
    recTd * 6.0 -
    fumblesLost * 2.0 +
    twoPt * 2.0
  );
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Rank keys 1..n by value descending (highest value -> rank 1). */
export function denseRankDesc(values: Record<string, number>): Record<string, number> {
  // True dense rank: equal values share a rank (e.g. every RB on the same team
  // has the same schedule, so the same OVR rank) and ranks have no gaps.
  const uniqueDesc = [...new Set(Object.values(values))].sort((a, b) => b - a);
  const rankOf = new Map(uniqueDesc.map((v, i) => [v, i + 1]));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) out[k] = rankOf.get(v)!;
  return out;
}

// ---------------------------------------------------------------------------
// Snapshot shape (written by fpa-ingest, read by build-sos)
// ---------------------------------------------------------------------------

export interface SnapshotDefense {
  defenseTeam: string;
  raw: number;
  adj: number;
  rank: number;
  bucket: Bucket;
}

export interface SnapshotPlayer {
  playerId: string;
  playerName: string;
  baselineTeam: string | null;
  totalPoints: number;
}

export interface SnapshotPosition {
  leagueAvg: number;
  defenses: SnapshotDefense[];
  players: SnapshotPlayer[];
}

export interface FpaSnapshot {
  season: number;
  scoring: string;
  updatedAt: string;
  positions: Record<Position, SnapshotPosition>;
}

export function snapshotFile(season: number, slug: string): string {
  return join(SNAPSHOT_DIR, `fpa-snapshot-${season}-${slug}.json`);
}
