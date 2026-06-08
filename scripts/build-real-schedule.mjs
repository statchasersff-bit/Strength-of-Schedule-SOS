#!/usr/bin/env node
/**
 * Replace the demo 2026 schedule with the REAL NFL schedule from nflverse.
 *
 * Data source: nflverse `games.csv` release
 *   https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv
 * This is the same authoritative schedule `scripts/build_sos.py` consumes via
 * the `nflreadpy` package — we just fetch the released CSV directly so the app
 * shows real matchups without needing the Python pipeline.
 *
 * What it does:
 *   1. Builds public/data/sos/schedule-2026.json from real REG-season games.
 *   2. Patches the embedded opponents (opponent / isHome / isBye) in every
 *      team-sos-*.json and player-sos-*.json so the Team & Player matrix tabs
 *      show the same real matchups as the Schedule tab.
 *
 * NOTE: the SOS *difficulty* numbers (rank / adjustedPoints / difficultyBucket)
 * are still the demo values — computing real strength-of-schedule requires the
 * 2025 defensive baseline built by scripts/build_sos.py (nflreadpy). Only the
 * matchups (who plays whom, home/away, byes) are made real here.
 *
 *   node scripts/build-real-schedule.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "artifacts", "statchasers-sos", "public", "data", "sos");
const SEASON = 2026;
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const SCHEDULE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";

// nflverse uses "LA" for the Rams; this app's data uses "LAR". Everything else
// matches. Map nflverse abbreviations -> app abbreviations here.
const TEAM_ALIAS = { LA: "LAR" };
const fix = (t) => TEAM_ALIAS[t] ?? t;

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      season: Number(cols[idx.season]),
      gameType: cols[idx.game_type],
      week: Number(cols[idx.week]),
      gameday: cols[idx.gameday] || null,
      home: fix(cols[idx.home_team]),
      away: fix(cols[idx.away_team]),
    };
  });
}

async function loadGames() {
  const res = await fetch(SCHEDULE_URL);
  if (!res.ok) throw new Error(`Failed to fetch schedule: ${res.status}`);
  const rows = parseCsv(await res.text());
  return rows.filter((r) => r.season === SEASON && r.gameType === "REG");
}

// team -> week -> { opponent, isHome, gameDate }
function buildLookup(games) {
  const map = new Map();
  const put = (team, week, opponent, isHome, gameDate) => {
    if (!map.has(team)) map.set(team, new Map());
    map.get(team).set(week, { opponent, isHome, gameDate });
  };
  for (const g of games) {
    put(g.home, g.week, g.away, true, g.gameday);
    put(g.away, g.week, g.home, false, g.gameday);
  }
  return map;
}

// Return the real cell for a team/week, or a bye cell if none scheduled.
function realCell(lookup, team, week) {
  const g = lookup.get(team)?.get(week);
  if (!g) return { opponent: null, isHome: null, isBye: true, gameDate: null };
  return { opponent: g.opponent, isHome: g.isHome, isBye: false, gameDate: g.gameDate };
}

function writeJson(file, obj) {
  writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

async function main() {
  const games = await loadGames();
  const lookup = buildLookup(games);
  const teams = [...lookup.keys()].sort();

  if (teams.length !== 32) {
    throw new Error(`Expected 32 teams, got ${teams.length}: ${teams.join(",")}`);
  }

  // 1. schedule-2026.json — flat list, one row per team/week.
  const scheduleGames = [];
  for (const team of teams) {
    for (const week of WEEKS) {
      const c = realCell(lookup, team, week);
      scheduleGames.push({
        week,
        team,
        opponent: c.opponent,
        isHome: c.isBye ? false : c.isHome,
        isBye: c.isBye,
        gameDate: c.gameDate,
      });
    }
  }
  const scheduleFile = join(DATA_DIR, `schedule-${SEASON}.json`);
  writeJson(scheduleFile, { season: SEASON, games: scheduleGames });
  console.log(`Wrote ${scheduleGames.length} games -> ${scheduleFile}`);

  // 2. Patch opponents in team-sos / player-sos files (keep demo difficulty).
  const sosFiles = readdirSync(DATA_DIR).filter(
    (f) => /^(team|player)-sos-.*\.json$/.test(f),
  );
  let patched = 0;
  for (const f of sosFiles) {
    const file = join(DATA_DIR, f);
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const row of data.rows ?? []) {
      const patchCell = (cell) => {
        if (!cell || typeof cell.week !== "number") return;
        const c = realCell(lookup, row.team, cell.week);
        cell.opponent = c.opponent;
        cell.isHome = c.isBye ? null : c.isHome;
        cell.isBye = c.isBye;
      };
      (row.weeks ?? []).forEach(patchCell);
      patchCell(row.playoff2);
      patchCell(row.playoff3);
    }
    writeJson(file, data);
    patched++;
  }
  console.log(`Patched opponents in ${patched} SOS files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
