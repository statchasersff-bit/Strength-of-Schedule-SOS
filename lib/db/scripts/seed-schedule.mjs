// Seed the nfl_schedules table with the REAL NFL schedule from ESPN.
//
// Source: ESPN public scoreboard API (no key required).
// Usage:   node lib/db/scripts/seed-schedule.mjs [season]
//          DATABASE_URL must be set.
//
// Idempotent: upserts on the (season, week, team) unique constraint, so it can
// be re-run safely (e.g. once the official schedule is finalized/updated).

import pg from "pg";

const { Pool } = pg;

const SEASON = Number(process.argv[2] ?? 2026);
const WEEKS = 18; // NFL regular season
const SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WSH",
];

async function fetchWeek(week) {
  const url = `${SCOREBOARD}?dates=${SEASON}&seasontype=2&week=${week}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN ${week} -> HTTP ${res.status}`);
  }
  return res.json();
}

async function buildEntries() {
  const entries = [];
  // team -> set of weeks it has a game (to derive byes)
  const teamWeeks = Object.fromEntries(NFL_TEAMS.map((t) => [t, new Set()]));

  for (let week = 1; week <= WEEKS; week++) {
    const data = await fetchWeek(week);
    for (const event of data.events ?? []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;
      const homeAbbr = home.team.abbreviation;
      const awayAbbr = away.team.abbreviation;
      const gameDate = event.date ?? null;

      entries.push({
        season: SEASON, week, team: homeAbbr, opponent: awayAbbr,
        isHome: true, isBye: false, gameDate,
      });
      entries.push({
        season: SEASON, week, team: awayAbbr, opponent: homeAbbr,
        isHome: false, isBye: false, gameDate,
      });
      teamWeeks[homeAbbr]?.add(week);
      teamWeeks[awayAbbr]?.add(week);
    }
    process.stdout.write(`  fetched week ${week} (${data.events?.length ?? 0} games)\n`);
  }

  // Fill bye weeks for any team-week with no game.
  for (const team of NFL_TEAMS) {
    for (let week = 1; week <= WEEKS; week++) {
      if (!teamWeeks[team].has(week)) {
        entries.push({
          season: SEASON, week, team, opponent: null,
          isHome: false, isBye: true, gameDate: null,
        });
      }
    }
  }

  return entries;
}

async function main() {
  console.log(`Seeding ${SEASON} schedule from ESPN...`);
  const entries = await buildEntries();
  console.log(`Built ${entries.length} schedule rows. Upserting...`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Clear any stale rows for this season (handles schedule changes that
    // remove a matchup), then upsert the fresh set.
    await client.query("DELETE FROM nfl_schedules WHERE season = $1", [SEASON]);
    for (const e of entries) {
      await client.query(
        `INSERT INTO nfl_schedules
           (season, week, team, opponent, is_home, is_bye, game_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (season, week, team) DO UPDATE SET
           opponent = EXCLUDED.opponent,
           is_home  = EXCLUDED.is_home,
           is_bye   = EXCLUDED.is_bye,
           game_date = EXCLUDED.game_date`,
        [e.season, e.week, e.team, e.opponent, e.isHome, e.isBye, e.gameDate]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  const games = entries.filter((e) => !e.isBye).length / 2;
  const byes = entries.filter((e) => e.isBye).length;
  console.log(`Done. ${games} games, ${byes} byes, ${entries.length} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
