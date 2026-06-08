#!/usr/bin/env node
/**
 * Generate schema-valid DEMO Strength-of-Schedule JSON for local development.
 *
 * This is NOT real data — it fabricates a plausible 2026 schedule and seeded
 * fantasy-points-allowed numbers so the frontend renders without running the
 * Python pipeline. Production data comes from `scripts/build_sos.py`.
 *
 *   node scripts/gen-demo-sos.mjs
 *
 * Output matches the file names / shapes the app fetches via
 * `src/lib/sos-client.ts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR =
  process.env.SOS_OUTPUT_DIR ??
  join(__dirname, "..", "artifacts", "statchasers-sos", "public", "data", "sos");

const SEASON = 2026;
const BASELINE_SEASON = 2025;
const POSITIONS = ["QB", "RB", "WR", "TE"];
const SCORINGS = { PPR: "ppr", HALF_PPR: "half-ppr", STANDARD: "std" };
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const PLAYOFF_WEEKS = [15, 16, 17];
const CURRENT_WEEK = 1;
const PLAYERS_PER_POSITION = 24;

const TEAM_META = {
  ARI: ["Arizona Cardinals", "NFC West"], ATL: ["Atlanta Falcons", "NFC South"],
  BAL: ["Baltimore Ravens", "AFC North"], BUF: ["Buffalo Bills", "AFC East"],
  CAR: ["Carolina Panthers", "NFC South"], CHI: ["Chicago Bears", "NFC North"],
  CIN: ["Cincinnati Bengals", "AFC North"], CLE: ["Cleveland Browns", "AFC North"],
  DAL: ["Dallas Cowboys", "NFC East"], DEN: ["Denver Broncos", "AFC West"],
  DET: ["Detroit Lions", "NFC North"], GB: ["Green Bay Packers", "NFC North"],
  HOU: ["Houston Texans", "AFC South"], IND: ["Indianapolis Colts", "AFC South"],
  JAX: ["Jacksonville Jaguars", "AFC South"], KC: ["Kansas City Chiefs", "AFC West"],
  LV: ["Las Vegas Raiders", "AFC West"], LAC: ["Los Angeles Chargers", "AFC West"],
  LAR: ["Los Angeles Rams", "NFC West"], MIA: ["Miami Dolphins", "AFC East"],
  MIN: ["Minnesota Vikings", "NFC North"], NE: ["New England Patriots", "AFC East"],
  NO: ["New Orleans Saints", "NFC South"], NYG: ["New York Giants", "NFC East"],
  NYJ: ["New York Jets", "AFC East"], PHI: ["Philadelphia Eagles", "NFC East"],
  PIT: ["Pittsburgh Steelers", "AFC North"], SF: ["San Francisco 49ers", "NFC West"],
  SEA: ["Seattle Seahawks", "NFC West"], TB: ["Tampa Bay Buccaneers", "NFC South"],
  TEN: ["Tennessee Titans", "AFC South"], WAS: ["Washington Commanders", "NFC East"],
};
const TEAMS = Object.keys(TEAM_META);

const BUCKETS = ["VERY_TOUGH", "TOUGH", "NEUTRAL", "FAVORABLE", "SMASH_SPOT"];
function bucketFromRank(rank, n) {
  if (!rank || n <= 0) return "NEUTRAL";
  const frac = (rank - 1) / Math.max(n - 1, 1);
  return BUCKETS[Math.min(Math.floor(frac * BUCKETS.length), BUCKETS.length - 1)];
}

// Deterministic hash -> [0, 1)
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const round1 = (x) => Math.round(x * 10) / 10;

// --- Synthetic schedule: one bye per team, deterministic pairings ---------
function buildSchedule() {
  const byeWeek = {}; // 4 teams per week, weeks 6-13
  TEAMS.forEach((t, i) => (byeWeek[t] = 6 + Math.floor(i / 4)));
  const oppMap = {}; // team -> {week -> [opp, isHome]}
  TEAMS.forEach((t) => (oppMap[t] = {}));

  for (const w of WEEKS) {
    const available = TEAMS.filter((t) => byeWeek[t] !== w)
      // rotate ordering per week so opponents vary
      .sort((a, b) => hash01(`${a}-${w}`) - hash01(`${b}-${w}`));
    for (let i = 0; i + 1 < available.length; i += 2) {
      const home = available[i];
      const away = available[i + 1];
      oppMap[home][w] = [away, true];
      oppMap[away][w] = [home, false];
    }
  }
  return oppMap;
}

// --- Per-position FPA (seeded) --------------------------------------------
const POS_BASE = { QB: 18, RB: 23, WR: 34, TE: 11 };
function computeFpa(pos, scoring) {
  const spread = POS_BASE[pos] * 0.35;
  const recAdj = scoring === "PPR" ? 1 : scoring === "HALF_PPR" ? 0.5 : 0;
  const rows = TEAMS.map((team) => {
    const r = hash01(`${team}-${pos}-${scoring}`);
    const adjusted = POS_BASE[pos] + (pos === "QB" ? 0 : recAdj * 2) + (r - 0.5) * 2 * spread;
    const raw = adjusted + (hash01(`raw-${team}-${pos}`) - 0.5) * 3;
    return { team, raw, adjusted };
  });
  rows.sort((a, b) => a.adjusted - b.adjusted); // ascending => toughest first
  const n = rows.length;
  const byTeam = {};
  rows.forEach((row, idx) => {
    byTeam[row.team] = {
      raw: row.raw,
      adjusted: row.adjusted,
      rank: idx + 1,
      bucket: bucketFromRank(idx + 1, n),
    };
  });
  return byTeam;
}

function weekCell(week, game, fpa) {
  if (!game) {
    return {
      week, opponent: null, isHome: null, isBye: true,
      rank: null, adjustedPoints: null, difficultyBucket: null, difficultyScore: null,
    };
  }
  const [opp, isHome] = game;
  const f = fpa[opp];
  return {
    week, opponent: opp, isHome, isBye: false,
    rank: f.rank, adjustedPoints: round1(f.adjusted),
    difficultyBucket: f.bucket, difficultyScore: round1(f.adjusted),
  };
}

function avgOver(weeks, sched, fpa) {
  const vals = weeks
    .map((w) => sched[w])
    .filter((g) => g && fpa[g[0]])
    .map((g) => fpa[g[0]].adjusted);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function aggregateCell(weeks, sched, fpa, allAvgs, team, labelWeek) {
  const avg = avgOver(weeks, sched, fpa);
  if (avg == null) return null;
  const ranked = Object.entries(allAvgs).sort((a, b) => a[1] - b[1]);
  const rank = ranked.findIndex(([t]) => t === team) + 1;
  return {
    week: labelWeek, opponent: null, isHome: null, isBye: false,
    rank, adjustedPoints: round1(avg),
    difficultyBucket: bucketFromRank(rank, ranked.length), difficultyScore: round1(avg),
  };
}

// rank keys 1..n by value descending (highest avg allowed = easiest = rank 1)
function denseRankDesc(values) {
  const ordered = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const out = {};
  ordered.forEach(([k], i) => (out[k] = i + 1));
  return out;
}

function buildTeamSos(pos, scoring, fpa, oppMap) {
  const full = {}, playoff = {};
  for (const team of TEAMS) {
    full[team] = avgOver(WEEKS, oppMap[team], fpa) ?? 0;
    playoff[team] = avgOver(PLAYOFF_WEEKS, oppMap[team], fpa) ?? 0;
  }
  const overallRank = denseRankDesc(full);
  const playoffRank = denseRankDesc(playoff);

  const rows = TEAMS.map((team) => {
    const sched = oppMap[team];
    const [name, division] = TEAM_META[team];
    return {
      team, teamFullName: name, division,
      overallRank: overallRank[team], rosRank: overallRank[team], playoffRank: playoffRank[team],
      weeks: WEEKS.map((w) => weekCell(w, sched[w], fpa)),
      playoff2: aggregateCell([16, 17], sched, fpa, playoff, team, 16),
      playoff3: aggregateCell(PLAYOFF_WEEKS, sched, fpa, playoff, team, 17),
      rosSummary: round1(full[team]),
    };
  }).sort((a, b) => a.overallRank - b.overallRank);

  return { season: SEASON, position: pos, scoring, currentWeek: CURRENT_WEEK, rows };
}

function buildPlayerSos(pos, scoring, fpa, oppMap) {
  const full = {}, playoff = {};
  for (const team of TEAMS) {
    full[team] = avgOver(WEEKS, oppMap[team], fpa) ?? 0;
    playoff[team] = avgOver(PLAYOFF_WEEKS, oppMap[team], fpa) ?? 0;
  }
  // Fabricate players: spread across teams, ranked by their team's schedule.
  const players = [];
  for (let i = 0; i < PLAYERS_PER_POSITION; i++) {
    const team = TEAMS[i % TEAMS.length];
    players.push({
      playerId: `demo-${pos}-${i + 1}`,
      playerName: `${team} ${pos}${Math.floor(i / TEAMS.length) + 1}`,
      team,
    });
  }
  const sosVals = Object.fromEntries(players.map((p) => [p.playerId, full[p.team]]));
  const poVals = Object.fromEntries(players.map((p) => [p.playerId, playoff[p.team]]));
  const sosRank = denseRankDesc(sosVals);
  const poRank = denseRankDesc(poVals);

  const rows = players.map((p) => {
    const sched = oppMap[p.team];
    return {
      playerId: p.playerId, playerName: p.playerName, team: p.team, position: pos,
      sosRank: sosRank[p.playerId], playoffSosRank: poRank[p.playerId], rosSosRank: sosRank[p.playerId],
      weeks: WEEKS.map((w) => weekCell(w, sched[w], fpa)),
      playoff2: aggregateCell([16, 17], sched, fpa, playoff, p.team, 16),
      playoff3: aggregateCell(PLAYOFF_WEEKS, sched, fpa, playoff, p.team, 17),
    };
  }).sort((a, b) => a.sosRank - b.sosRank);

  return { season: SEASON, position: pos, scoring, currentWeek: CURRENT_WEEK, rows };
}

function buildFpa(pos, scoring, fpa) {
  const rows = Object.entries(fpa)
    .map(([team, f]) => ({
      defenseTeam: team, position: pos, scoringFormat: scoring,
      rawPointsAllowed: round1(f.raw), adjustedPointsAllowed: round1(f.adjusted),
      rank: f.rank, difficultyBucket: f.bucket,
    }))
    .sort((a, b) => a.rank - b.rank);
  return { season: BASELINE_SEASON, position: pos, scoring, rows };
}

function buildSchedule_(oppMap) {
  const games = [];
  for (const team of TEAMS) {
    for (const w of WEEKS) {
      const g = oppMap[team][w];
      games.push(
        g
          ? { week: w, team, opponent: g[0], isHome: g[1], isBye: false, gameDate: null }
          : { week: w, team, opponent: null, isHome: false, isBye: true, gameDate: null },
      );
    }
  }
  return { season: SEASON, games };
}

function buildInsights(scoring, teamSosByPos) {
  const full = {}, playoff = {};
  for (const data of Object.values(teamSosByPos)) {
    for (const row of data.rows) {
      (full[row.team] ??= []).push(row.rosSummary ?? 0);
      if (row.playoff3?.adjustedPoints != null)
        (playoff[row.team] ??= []).push(row.playoff3.adjustedPoints);
    }
  }
  const avg = (o) => Object.fromEntries(Object.entries(o).map(([t, v]) => [t, v.reduce((a, b) => a + b, 0) / v.length]));
  const fa = avg(full), pa = avg(playoff);
  const maxBy = (o) => Object.entries(o).reduce((m, e) => (e[1] > m[1] ? e : m))[0];
  const minBy = (o) => Object.entries(o).reduce((m, e) => (e[1] < m[1] ? e : m))[0];
  const easiest = maxBy(fa), toughest = minBy(fa), bestPo = maxBy(pa), worstPo = minBy(pa);
  const card = (id, title, subtitle, team, detail, trend) => ({
    id, title, subtitle, value: team, detail, position: "ALL", team, trend,
  });
  return {
    season: SEASON, scoring,
    cards: [
      card("easiest-schedule", "Easiest Schedule", "Full season", easiest, `${round1(fa[easiest])} adj pts`, "positive"),
      card("toughest-schedule", "Toughest Schedule", "Full season", toughest, `${round1(fa[toughest])} adj pts`, "negative"),
      card("best-playoff", "Best Playoff Slate", "Weeks 15-17", bestPo, `${round1(pa[bestPo])} adj pts`, "positive"),
      card("toughest-playoff", "Toughest Playoff Slate", "Weeks 15-17", worstPo, `${round1(pa[worstPo])} adj pts`, "negative"),
    ],
  };
}

function writeJson(name, payload) {
  writeFileSync(join(OUTPUT_DIR, name), JSON.stringify(payload, null, 2));
  return name;
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const oppMap = buildSchedule();
  const files = [];

  files.push(writeJson(`schedule-${SEASON}.json`, buildSchedule_(oppMap)));

  for (const [scoring, slug] of Object.entries(SCORINGS)) {
    const teamSosByPos = {};
    for (const pos of POSITIONS) {
      const fpa = computeFpa(pos, scoring);
      const p = pos.toLowerCase();
      const teamSos = buildTeamSos(pos, scoring, fpa, oppMap);
      teamSosByPos[pos] = teamSos;
      files.push(writeJson(`team-sos-${SEASON}-${p}-${slug}.json`, teamSos));
      files.push(writeJson(`player-sos-${SEASON}-${p}-${slug}.json`, buildPlayerSos(pos, scoring, fpa, oppMap)));
      files.push(writeJson(`fpa-${BASELINE_SEASON}-${p}-${slug}.json`, buildFpa(pos, scoring, fpa)));
    }
    files.push(writeJson(`insights-${SEASON}-${slug}.json`, buildInsights(scoring, teamSosByPos)));
  }

  writeJson("manifest.json", {
    season: SEASON,
    baselineSeasons: [BASELINE_SEASON],
    updatedAt: "2026-06-08T00:00:00Z",
    currentWeek: CURRENT_WEEK,
    positions: POSITIONS,
    scoring: Object.keys(SCORINGS),
    demo: true,
    files: files.slice().sort(),
  });

  console.log(`Wrote ${files.length + 1} demo files to ${OUTPUT_DIR}`);
}

main();
