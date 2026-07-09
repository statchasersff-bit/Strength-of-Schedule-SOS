#!/usr/bin/env tsx
/**
 * build-sos.ts — maps the 2026 schedule onto the FPA snapshot.
 *
 * This stage NEVER recomputes aFPA. It reads the snapshot produced by
 * fpa-ingest.ts (the canonical aFPA source) and, for each team's weekly
 * opponent, looks up that opponent defense's POSITION-SPECIFIC adjusted FPA.
 *
 *   QB SOS uses the opponent defense's "vs QB" adj, RB uses "vs RB", etc.
 *
 * Outputs the static JSON the frontend reads: schedule, team-sos, player-sos,
 * insights and manifest.
 *
 * Run:  pnpm --filter @workspace/scripts run build:sos
 *   or: tsx scripts/build-sos.ts   (after fpa-ingest.ts)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  BASELINE_SEASONS,
  DATA_DIR,
  FANTASY_LAST_WEEK,
  FANTASY_PLAYOFF_WEEKS,
  FANTASY_WEEKS,
  POSITIONS,
  REGULAR_SEASON_WEEKS,
  SCHEDULE_URL,
  SCORINGS,
  SEASON,
  TEAM_ABBRS,
  TEAM_META,
  bucketFromRank,
  denseRankDesc,
  fetchCsvRows,
  mean,
  normTeam,
  num,
  round1,
  snapshotFile,
  type Bucket,
  type FpaSnapshot,
  type Position,
  type SnapshotDefense,
} from "./sos-lib.ts";
import {
  loadSleeperPlayers,
  loadSleeperMaxProj,
  sleeperHeadshot,
  type SleeperPlayer,
  type MaxProj,
} from "./sleeper.ts";

/** Minimum projected points (PPR) in any single game to be listed. */
const MIN_GAME_PROJ = 8;

// --- schedule -------------------------------------------------------------

interface Game {
  opponent: string;
  isHome: boolean;
  gameDate: string | null;
}
type TeamSchedule = Map<number, Game>; // week -> game

async function loadSchedule(): Promise<{
  byTeam: Map<string, TeamSchedule>;
  currentWeek: number;
}> {
  const rows = await fetchCsvRows(SCHEDULE_URL, [
    "season",
    "game_type",
    "week",
    "gameday",
    "home_team",
    "away_team",
    "result",
  ]);
  const byTeam = new Map<string, TeamSchedule>();
  const put = (team: string, week: number, g: Game) => {
    if (!byTeam.has(team)) byTeam.set(team, new Map());
    byTeam.get(team)!.set(week, g);
  };
  let maxPlayedWeek = 0;
  for (const r of rows) {
    if (num(r.season) !== SEASON || r.game_type !== "REG") continue;
    const week = num(r.week);
    const home = normTeam(r.home_team);
    const away = normTeam(r.away_team);
    if (!week || !home || !away) continue;
    const date = r.gameday || null;
    put(home, week, { opponent: away, isHome: true, gameDate: date });
    put(away, week, { opponent: home, isHome: false, gameDate: date });
    if (r.result !== "" && r.result != null) maxPlayedWeek = Math.max(maxPlayedWeek, week);
  }
  const currentWeek = Math.min(maxPlayedWeek + 1, 18);
  return { byTeam, currentWeek };
}

// --- cells ----------------------------------------------------------------

interface WeekCell {
  week: number;
  opponent: string | null;
  isHome: boolean | null;
  isAway: boolean | null;
  isBye: boolean;
  raw: number | null;
  rank: number | null;
  adjustedPoints: number | null;
  difficultyBucket: Bucket | null;
  difficultyScore: number | null;
}

type DefMap = Map<string, SnapshotDefense>;

function byeCell(week: number): WeekCell {
  return {
    week,
    opponent: null,
    isHome: null,
    isAway: null,
    isBye: true,
    raw: null,
    rank: null,
    adjustedPoints: null,
    difficultyBucket: null,
    difficultyScore: null,
  };
}

function weekCell(week: number, game: Game | undefined, def: DefMap): WeekCell {
  if (!game) return byeCell(week);
  const d = def.get(game.opponent);
  return {
    week,
    opponent: game.opponent,
    isHome: game.isHome,
    isAway: !game.isHome,
    isBye: false,
    raw: d ? round1(d.raw) : null,
    rank: d ? d.rank : null,
    adjustedPoints: d ? round1(d.adj) : null,
    difficultyBucket: d ? d.bucket : "NEUTRAL",
    difficultyScore: d ? round1(d.adj) : null,
  };
}

/** Mean opponent adj over the given weeks (skips byes / unknown opponents). */
function avgOver(weeks: number[], sched: TeamSchedule, def: DefMap): number | null {
  const vals: number[] = [];
  for (const w of weeks) {
    const g = sched.get(w);
    if (!g) continue;
    const d = def.get(g.opponent);
    if (d) vals.push(d.adj);
  }
  return vals.length ? mean(vals) : null;
}

/** A synthetic cell summarizing a playoff stretch, ranked across all teams. */
function aggregateCell(
  weeks: number[],
  sched: TeamSchedule,
  def: DefMap,
  allTeamPlayoffAvg: Record<string, number>,
  team: string,
  labelWeek: number,
): WeekCell | null {
  const avg = avgOver(weeks, sched, def);
  if (avg == null) return null;
  const ordered = Object.entries(allTeamPlayoffAvg).sort((a, b) => a[1] - b[1]);
  const rank = ordered.findIndex(([t]) => t === team) + 1 || null;
  return {
    week: labelWeek,
    opponent: null,
    isHome: null,
    isAway: null,
    isBye: false,
    raw: null,
    rank,
    adjustedPoints: round1(avg),
    difficultyBucket: rank ? bucketFromRank(rank) : "NEUTRAL",
    difficultyScore: round1(avg),
  };
}

// --- per (scoring, position) builders -------------------------------------

const rosWeeks = (currentWeek: number) =>
  REGULAR_SEASON_WEEKS.filter((w) => w >= currentWeek && w <= FANTASY_LAST_WEEK);

interface TeamAverages {
  full: Record<string, number>;
  ros: Record<string, number>;
  /** PO3 basis: weeks 15-17. */
  playoff: Record<string, number>;
  /** PO2 basis: weeks 16-17 (championship-week emphasis, ranked on its own). */
  playoff2: Record<string, number>;
}

function teamAverages(
  byTeam: Map<string, TeamSchedule>,
  def: DefMap,
  currentWeek: number,
): TeamAverages {
  const full: Record<string, number> = {};
  const ros: Record<string, number> = {};
  const playoff: Record<string, number> = {};
  const playoff2: Record<string, number> = {};
  const rw = rosWeeks(currentWeek);
  for (const team of TEAM_ABBRS) {
    const sched = byTeam.get(team) ?? new Map();
    full[team] = avgOver(FANTASY_WEEKS, sched, def) ?? 0;
    ros[team] = avgOver(rw, sched, def) ?? 0;
    playoff[team] = avgOver(FANTASY_PLAYOFF_WEEKS, sched, def) ?? 0;
    playoff2[team] = avgOver([16, 17], sched, def) ?? 0;
  }
  return { full, ros, playoff, playoff2 };
}

function buildTeamSos(
  pos: Position,
  scoring: string,
  def: DefMap,
  byTeam: Map<string, TeamSchedule>,
  avgs: TeamAverages,
  currentWeek: number,
) {
  const overallRank = denseRankDesc(avgs.full);
  const rosRank = denseRankDesc(avgs.ros);
  const playoffRank = denseRankDesc(avgs.playoff);

  const rows = TEAM_ABBRS.map((team) => {
    const sched = byTeam.get(team) ?? new Map();
    const weeks = FANTASY_WEEKS.map((w) => weekCell(w, sched.get(w), def));
    return {
      team,
      teamFullName: TEAM_META[team].name,
      division: TEAM_META[team].division,
      overallRank: overallRank[team],
      rosRank: rosRank[team],
      playoffRank: playoffRank[team],
      weeks,
      playoff2: aggregateCell([16, 17], sched, def, avgs.playoff2, team, 16),
      playoff3: aggregateCell(FANTASY_PLAYOFF_WEEKS, sched, def, avgs.playoff, team, 17),
      rosSummary: round1(avgs.ros[team]),
    };
  });
  rows.sort((a, b) => a.overallRank - b.overallRank);
  return { season: SEASON, position: pos, scoring, currentWeek, rows };
}

/**
 * The Player SOS pool comes from Sleeper's live depth chart + projections, not
 * the FPA baseline. A player is listed when they are projected to score
 * >= MIN_GAME_PROJ fantasy points (for this scoring) in any single game.
 *
 * Projection — not Sleeper's depth_chart_order — is the gate, because the
 * offseason depth chart is often stale: e.g. it can still list a displaced
 * veteran as QB1 (Kirk Cousins, projMax ~3.5) while the real starter is
 * unranked (Fernando Mendoza, projMax ~13.9). A genuine starter always projects
 * >= 8 in at least one game, so this keeps them and drops the stale label.
 * `isStarter` is still surfaced as a flag, just not used for inclusion.
 */
function buildPlayerSos(
  pos: Position,
  scoring: string,
  def: DefMap,
  byTeam: Map<string, TeamSchedule>,
  avgs: TeamAverages,
  sleeperPlayers: Map<string, SleeperPlayer>,
  maxProj: Map<string, MaxProj>,
  currentWeek: number,
) {
  // Gate on PPR projection for every scoring so the player set is consistent
  // across formats (the schedule a player faces doesn't change by scoring, and
  // a flat 8-pt bar in Standard would wipe out most TEs/WRs).
  const pool = [...sleeperPlayers.values()].filter((p) => {
    if (p.position !== pos || !p.team || !byTeam.has(p.team)) return false;
    const proj = maxProj.get(p.playerId)?.ppr ?? 0;
    return proj >= MIN_GAME_PROJ;
  });

  const sosVals: Record<string, number> = {};
  const rosVals: Record<string, number> = {};
  const poVals: Record<string, number> = {};
  for (const p of pool) {
    sosVals[p.playerId] = avgs.full[p.team!];
    rosVals[p.playerId] = avgs.ros[p.team!];
    poVals[p.playerId] = avgs.playoff[p.team!];
  }
  const sosRank = denseRankDesc(sosVals);
  const rosRank = denseRankDesc(rosVals);
  const poRank = denseRankDesc(poVals);

  const rows = pool.map((p) => {
    const team = p.team!;
    const sched = byTeam.get(team)!;
    return {
      playerId: p.playerId,
      playerName: p.name,
      headshotUrl: sleeperHeadshot(p.playerId),
      team,
      position: pos,
      isStarter: p.depthOrder === 1,
      projMax: round1(maxProj.get(p.playerId)?.ppr ?? 0),
      sosRank: sosRank[p.playerId],
      playoffSosRank: poRank[p.playerId],
      rosSosRank: rosRank[p.playerId],
      weeks: FANTASY_WEEKS.map((w) => weekCell(w, sched.get(w), def)),
      playoff2: aggregateCell([16, 17], sched, def, avgs.playoff2, team, 16),
      playoff3: aggregateCell(FANTASY_PLAYOFF_WEEKS, sched, def, avgs.playoff, team, 17),
    };
  });
  // Same schedule (same team) -> same sosRank; show the higher-projected player
  // first so the default order is meaningful within a tie.
  rows.sort((a, b) => a.sosRank - b.sosRank || b.projMax - a.projMax || a.playerName.localeCompare(b.playerName));
  return { season: SEASON, position: pos, scoring, currentWeek, rows };
}

function buildSchedule(byTeam: Map<string, TeamSchedule>) {
  const games: unknown[] = [];
  for (const team of TEAM_ABBRS) {
    const sched = byTeam.get(team) ?? new Map();
    for (const w of REGULAR_SEASON_WEEKS) {
      const g = sched.get(w);
      games.push(
        g
          ? { week: w, team, opponent: g.opponent, isHome: g.isHome, isBye: false, gameDate: g.gameDate }
          : { week: w, team, opponent: null, isHome: false, isBye: true, gameDate: null },
      );
    }
  }
  return { season: SEASON, games };
}

function buildInsights(
  scoring: string,
  fullByPos: Record<string, number>[],
  playoffByPos: Record<string, number>[],
) {
  const avgAcross = (maps: Record<string, number>[]) => {
    const out: Record<string, number[]> = {};
    for (const m of maps)
      for (const [t, v] of Object.entries(m)) (out[t] ??= []).push(v);
    const res: Record<string, number> = {};
    for (const [t, vs] of Object.entries(out)) res[t] = mean(vs);
    return res;
  };
  const full = avgAcross(fullByPos);
  const playoff = avgAcross(playoffByPos);
  const keys = Object.keys(full);
  if (keys.length === 0) return { season: SEASON, scoring, cards: [] };

  const maxBy = (m: Record<string, number>) =>
    Object.entries(m).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const minBy = (m: Record<string, number>) =>
    Object.entries(m).reduce((a, b) => (b[1] < a[1] ? b : a))[0];

  const easiest = maxBy(full);
  const toughest = minBy(full);
  const bestPo = Object.keys(playoff).length ? maxBy(playoff) : easiest;
  const worstPo = Object.keys(playoff).length ? minBy(playoff) : toughest;

  const card = (
    id: string,
    title: string,
    subtitle: string,
    team: string,
    detail: string,
    trend: "positive" | "negative",
  ) => ({ id, title, subtitle, value: team, detail, position: "ALL", team, trend });

  return {
    season: SEASON,
    scoring,
    cards: [
      card("easiest-schedule", "Easiest Schedule", "Full season", easiest, `${round1(full[easiest])} adj pts`, "positive"),
      card("toughest-schedule", "Toughest Schedule", "Full season", toughest, `${round1(full[toughest])} adj pts`, "negative"),
      card("best-playoff", "Best Playoff Slate", "Weeks 15-17", bestPo, `${round1(playoff[bestPo] ?? 0)} adj pts`, "positive"),
      card("toughest-playoff", "Toughest Playoff Slate", "Weeks 15-17", worstPo, `${round1(playoff[worstPo] ?? 0)} adj pts`, "negative"),
    ],
  };
}

function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

function loadSnapshot(slug: string): FpaSnapshot {
  const season = BASELINE_SEASONS[BASELINE_SEASONS.length - 1];
  const file = snapshotFile(season, slug);
  try {
    return JSON.parse(readFileSync(file, "utf8")) as FpaSnapshot;
  } catch {
    throw new Error(`Missing FPA snapshot ${file}. Run fpa-ingest.ts first.`);
  }
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Loading ${SEASON} schedule + Sleeper depth chart/projections...`);
  const { byTeam, currentWeek } = await loadSchedule();
  const sleeperPlayers = await loadSleeperPlayers();
  const maxProj = await loadSleeperMaxProj(SEASON, FANTASY_WEEKS);
  console.log(`  Sleeper: ${sleeperPlayers.size} players, ${maxProj.size} with projections`);
  const teamCount = byTeam.size;
  if (teamCount !== 32) {
    console.warn(`  warning: expected 32 teams in schedule, got ${teamCount}`);
  }
  console.log(`Current week: ${currentWeek}`);

  const updatedAt = new Date().toISOString();
  const written: string[] = [];

  const scheduleFile = `schedule-${SEASON}.json`;
  writeJson(`${DATA_DIR}/${scheduleFile}`, buildSchedule(byTeam));
  written.push(scheduleFile);

  for (const [scoring, { slug }] of Object.entries(SCORINGS)) {
    console.log(`Scoring: ${scoring}`);
    const snap = loadSnapshot(slug);
    const fullByPos: Record<string, number>[] = [];
    const playoffByPos: Record<string, number>[] = [];

    for (const pos of POSITIONS) {
      const def: DefMap = new Map(
        snap.positions[pos].defenses.map((d) => [d.defenseTeam, d]),
      );
      const avgs = teamAverages(byTeam, def, currentWeek);
      fullByPos.push(avgs.full);
      playoffByPos.push(avgs.playoff);

      const teamSos = buildTeamSos(pos, scoring, def, byTeam, avgs, currentWeek);
      const teamFile = `team-sos-${SEASON}-${pos.toLowerCase()}-${slug}.json`;
      writeJson(`${DATA_DIR}/${teamFile}`, teamSos);
      written.push(teamFile);

      const playerSos = buildPlayerSos(
        pos, scoring, def, byTeam, avgs, sleeperPlayers, maxProj, currentWeek,
      );
      const playerFile = `player-sos-${SEASON}-${pos.toLowerCase()}-${slug}.json`;
      writeJson(`${DATA_DIR}/${playerFile}`, playerSos);
      written.push(playerFile);
      console.log(`  ${pos}: ${teamSos.rows.length} teams, ${playerSos.rows.length} players`);
    }

    const insightsFile = `insights-${SEASON}-${slug}.json`;
    writeJson(`${DATA_DIR}/${insightsFile}`, buildInsights(scoring, fullByPos, playoffByPos));
    written.push(insightsFile);
  }

  // fpa-*.json files are written by fpa-ingest; include them in the manifest.
  const baselineSeason = BASELINE_SEASONS[BASELINE_SEASONS.length - 1];
  for (const { slug } of Object.values(SCORINGS))
    for (const pos of POSITIONS)
      written.push(`fpa-${baselineSeason}-${pos.toLowerCase()}-${slug}.json`);

  const manifest = {
    season: SEASON,
    baselineSeasons: BASELINE_SEASONS,
    updatedAt,
    currentWeek,
    positions: POSITIONS,
    scoring: Object.keys(SCORINGS),
    files: [...written].sort(),
  };
  writeJson(`${DATA_DIR}/manifest.json`, manifest);
  console.log(`Done. ${written.length + 1} files written to ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
