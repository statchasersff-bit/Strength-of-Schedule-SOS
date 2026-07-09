#!/usr/bin/env tsx
/**
 * fpa-ingest.ts — the CANONICAL adjusted-fantasy-points-allowed calculator.
 *
 * This is the single source of truth for aFPA. It reads nflverse weekly player
 * stats for the baseline season(s) and, for every (defense, position, scoring
 * format), computes:
 *
 *   raw  = total fantasy points allowed to that position / games played
 *   SOS  = average offensive PPG of the offenses that defense faced at that
 *          position (repeat opponents counted per meeting; unknown -> leagueAvg)
 *   adj  = raw - (SOS - leagueAvg)
 *
 * where:
 *   offPpg[pos][team] = that offense's per-game fantasy output at the position
 *   leagueAvg[pos]    = mean offPpg across all teams for that position
 *
 * Defenses are ranked by `adj` ascending (rank 1 = toughest), then bucketed.
 * The result is written as an FPA *snapshot* per season+scoring; build-sos.ts
 * consumes the snapshot and never recomputes aFPA.
 *
 * Run:  pnpm --filter @workspace/scripts run ingest:fpa
 *   or: tsx scripts/fpa-ingest.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  BASELINE_SEASONS,
  DATA_DIR,
  FANTASY_LAST_WEEK,
  POSITIONS,
  PLAYERS_PER_POSITION,
  SCORINGS,
  SNAPSHOT_DIR,
  TEAM_ABBRS,
  bucketFromRank,
  fantasyPoints,
  fetchCsvRows,
  mean,
  normTeam,
  num,
  playerStatsUrl,
  positionGroup,
  round1,
  snapshotFile,
  type FpaSnapshot,
  type Position,
  type SnapshotDefense,
  type SnapshotPlayer,
  type SnapshotPosition,
} from "./sos-lib.ts";

const STAT_COLUMNS = [
  "player_id",
  "player_display_name",
  "player_name",
  "position",
  "position_group",
  "season",
  "week",
  "season_type",
  "team",
  "recent_team",
  "opponent_team",
  "passing_yards",
  "passing_tds",
  "passing_interceptions",
  "interceptions",
  "sack_fumbles_lost",
  "passing_2pt_conversions",
  "rushing_yards",
  "rushing_tds",
  "rushing_fumbles_lost",
  "rushing_2pt_conversions",
  "receptions",
  "receiving_yards",
  "receiving_tds",
  "receiving_fumbles_lost",
  "receiving_2pt_conversions",
];

interface GameRow {
  off: string;
  def: string;
  pos: Position;
  week: number;
  season: number;
  fp: number;
}

interface PlayerTotal {
  playerId: string;
  playerName: string;
  baselineTeam: string | null;
  total: number;
}

/** Load and tidy the baseline weekly stats once per scoring format. */
async function loadStats(): Promise<Record<string, string>[]> {
  const all: Record<string, string>[] = [];
  for (const season of BASELINE_SEASONS) {
    const url = playerStatsUrl(season);
    console.log(`  fetching ${url}`);
    const rows = await fetchCsvRows(url, STAT_COLUMNS);
    for (const r of rows) {
      if ((r.season_type || "REG") !== "REG") continue;
      // Fantasy season ends at week 17 — exclude week 18 from the baseline.
      if (num(r.week) > FANTASY_LAST_WEEK) continue;
      all.push(r);
    }
  }
  return all;
}

/** Per-(offense, defense, position, week) fantasy totals for one scoring. */
function gameRows(stats: Record<string, string>[], recPts: number): GameRow[] {
  // key -> accumulated fp (multiple players of the same position in one game)
  const acc = new Map<string, GameRow>();
  for (const r of stats) {
    const pos = positionGroup(r.position || r.position_group);
    if (!pos) continue;
    const off = normTeam(r.team || r.recent_team);
    const def = normTeam(r.opponent_team);
    if (!off || !def) continue;
    const week = num(r.week);
    const season = num(r.season);
    const fp = fantasyPoints(r, recPts);
    const key = `${off}|${def}|${pos}|${season}|${week}`;
    const existing = acc.get(key);
    if (existing) existing.fp += fp;
    else acc.set(key, { off, def, pos, week, season, fp });
  }
  return [...acc.values()];
}

/** Top-N players per position by total baseline fantasy points (one scoring). */
function topPlayers(
  stats: Record<string, string>[],
  recPts: number,
): Record<Position, SnapshotPlayer[]> {
  const byPlayer = new Map<string, Record<Position, PlayerTotal>>();
  for (const r of stats) {
    const pos = positionGroup(r.position || r.position_group);
    if (!pos) continue;
    const pid = String(r.player_id || "").trim();
    if (!pid) continue;
    const fp = fantasyPoints(r, recPts);
    let rec = byPlayer.get(pid);
    if (!rec) {
      rec = {} as Record<Position, PlayerTotal>;
      byPlayer.set(pid, rec);
    }
    const cur = rec[pos];
    const team = normTeam(r.team || r.recent_team);
    if (cur) {
      cur.total += fp;
      if (team) cur.baselineTeam = team; // last seen team
    } else {
      rec[pos] = {
        playerId: pid,
        playerName: r.player_display_name || r.player_name || pid,
        baselineTeam: team,
        total: fp,
      };
    }
  }

  const out = {} as Record<Position, SnapshotPlayer[]>;
  for (const pos of POSITIONS) {
    const list: PlayerTotal[] = [];
    for (const rec of byPlayer.values()) if (rec[pos]) list.push(rec[pos]);
    list.sort((a, b) => b.total - a.total);
    out[pos] = list.slice(0, PLAYERS_PER_POSITION).map((p) => ({
      playerId: p.playerId,
      playerName: p.playerName,
      baselineTeam: p.baselineTeam,
      totalPoints: round1(p.total),
    }));
  }
  return out;
}

/** Opponent-adjusted FPA for one position from the per-game totals. */
function computePosition(games: GameRow[], pos: Position): SnapshotPosition {
  const gp = games.filter((g) => g.pos === pos);
  if (gp.length === 0) {
    return { leagueAvg: 0, defenses: [], players: [] };
  }

  // offPpg[team] = mean fantasy output of that offense per game at this position
  const byOff = new Map<string, number[]>();
  for (const g of gp) {
    (byOff.get(g.off) ?? byOff.set(g.off, []).get(g.off)!).push(g.fp);
  }
  const offPpg = new Map<string, number>();
  for (const [team, vals] of byOff) offPpg.set(team, mean(vals));
  const leagueAvg = mean([...offPpg.values()]);

  // Per defense: raw = mean allowed; SOS = mean offPpg of offenses faced.
  const byDef = new Map<string, GameRow[]>();
  for (const g of gp) {
    (byDef.get(g.def) ?? byDef.set(g.def, []).get(g.def)!).push(g);
  }

  const defenses: SnapshotDefense[] = [];
  for (const [team, rows] of byDef) {
    const raw = mean(rows.map((r) => r.fp));
    const sos = mean(rows.map((r) => offPpg.get(r.off) ?? leagueAvg));
    const adj = raw - (sos - leagueAvg);
    defenses.push({ defenseTeam: team, raw, adj, rank: 0, bucket: "NEUTRAL" });
  }

  // rank 1 = fewest adjusted points allowed = toughest matchup.
  defenses.sort((a, b) => a.adj - b.adj);
  defenses.forEach((d, i) => {
    d.rank = i + 1;
    d.bucket = bucketFromRank(d.rank);
  });

  return { leagueAvg, defenses, players: [] };
}

function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

async function main(): Promise<void> {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });
  const baselineSeason = BASELINE_SEASONS[BASELINE_SEASONS.length - 1];

  console.log(`Loading baseline player stats for ${BASELINE_SEASONS.join(", ")}...`);
  const stats = await loadStats();
  console.log(`  ${stats.length} weekly stat rows`);

  const updatedAt = new Date().toISOString();

  for (const [scoring, { recPts, slug }] of Object.entries(SCORINGS)) {
    console.log(`Scoring: ${scoring}`);
    const games = gameRows(stats, recPts);
    const players = topPlayers(stats, recPts);

    const positions = {} as Record<Position, SnapshotPosition>;
    for (const pos of POSITIONS) {
      const computed = computePosition(games, pos);
      computed.players = players[pos];
      positions[pos] = computed;

      // Frontend FPA table file (FpaResponse shape) derived from the snapshot.
      const fpaRows = computed.defenses.map((d) => ({
        defenseTeam: d.defenseTeam,
        position: pos,
        scoringFormat: scoring,
        rawPointsAllowed: round1(d.raw),
        adjustedPointsAllowed: round1(d.adj),
        rank: d.rank,
        difficultyBucket: d.bucket,
      }));
      const fpaFile = `${DATA_DIR}/fpa-${baselineSeason}-${pos.toLowerCase()}-${slug}.json`;
      writeJson(fpaFile, {
        season: baselineSeason,
        position: pos,
        scoring,
        rows: fpaRows,
      });
      console.log(
        `  ${pos}: ${computed.defenses.length} defenses, leagueAvg ${round1(computed.leagueAvg)} -> fpa-${baselineSeason}-${pos.toLowerCase()}-${slug}.json`,
      );
    }

    const snapshot: FpaSnapshot = {
      season: baselineSeason,
      scoring,
      updatedAt,
      positions,
    };
    const snapFile = snapshotFile(baselineSeason, slug);
    writeJson(snapFile, snapshot);
    console.log(`  wrote snapshot ${snapFile}`);
  }

  console.log(`Done. Snapshots for a ${TEAM_ABBRS.length}-team league written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
