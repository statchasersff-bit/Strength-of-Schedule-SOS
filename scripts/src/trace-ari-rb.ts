#!/usr/bin/env tsx
/** One-off: show the per-game RB fantasy points ARI's defense allowed (PPR). */
import {
  BASELINE_SEASONS,
  FANTASY_LAST_WEEK,
  SCORINGS,
  fantasyPoints,
  fetchCsvRows,
  mean,
  normTeam,
  num,
  playerStatsUrl,
  positionGroup,
} from "./sos-lib.ts";

const DEF = (process.env.TRACE_DEF || "ARI").toUpperCase();
const POS = (process.env.TRACE_POS || "RB").toUpperCase();
const DETAIL_WEEK = process.env.TRACE_WEEK ? Number(process.env.TRACE_WEEK) : null;
const recPts = SCORINGS.PPR.recPts;
const season = BASELINE_SEASONS[BASELINE_SEASONS.length - 1];
const url = playerStatsUrl(season);
const rows = await fetchCsvRows(url, [
  "season", "season_type", "week", "position", "position_group",
  "team", "recent_team", "opponent_team", "player_display_name", "player_name",
  "passing_yards", "passing_tds", "passing_interceptions", "interceptions",
  "rushing_yards", "rushing_tds", "receptions", "receiving_yards", "receiving_tds",
  "rushing_fumbles_lost", "receiving_fumbles_lost", "sack_fumbles_lost",
  "passing_2pt_conversions", "rushing_2pt_conversions", "receiving_2pt_conversions",
]);

// week -> { offense, players:[{name,fp}], total }
const byWeek = new Map<number, { off: string; players: { name: string; fp: number }[]; total: number }>();
for (const r of rows) {
  if ((r.season_type || "REG") !== "REG") continue;
  if (num(r.week) > FANTASY_LAST_WEEK) continue;
  if (positionGroup(r.position || r.position_group) !== POS) continue;
  if (normTeam(r.opponent_team) !== DEF) continue; // DEF is the defense
  const week = num(r.week);
  const fp = fantasyPoints(r, recPts);
  const off = normTeam(r.team || r.recent_team) || "?";
  const name = r.player_display_name || r.player_name || "?";
  const w = byWeek.get(week) ?? { off, players: [], total: 0 };
  w.players.push({ name, fp });
  w.total += fp;
  byWeek.set(week, w);

  if (DETAIL_WEEK !== null && week === DETAIL_WEEK) {
    const rec = num(r.receptions);
    const recYds = num(r.receiving_yards);
    const recTd = num(r.receiving_tds);
    const rushYds = num(r.rushing_yards);
    const rushTd = num(r.rushing_tds);
    const fum =
      num(r.rushing_fumbles_lost) + num(r.receiving_fumbles_lost) + num(r.sack_fumbles_lost);
    const twoPt = num(r.receiving_2pt_conversions) + num(r.rushing_2pt_conversions);
    const parts: string[] = [];
    parts.push(`${rec} rec x1.0 = ${(rec * recPts).toFixed(1)}`);
    parts.push(`${recYds} recYd x0.1 = ${(recYds * 0.1).toFixed(1)}`);
    if (recTd) parts.push(`${recTd} recTD x6 = ${(recTd * 6).toFixed(1)}`);
    if (rushYds) parts.push(`${rushYds} rushYd x0.1 = ${(rushYds * 0.1).toFixed(1)}`);
    if (rushTd) parts.push(`${rushTd} rushTD x6 = ${(rushTd * 6).toFixed(1)}`);
    if (fum) parts.push(`${fum} fumLost x-2 = ${(fum * -2).toFixed(1)}`);
    if (twoPt) parts.push(`${twoPt} 2pt x2 = ${(twoPt * 2).toFixed(1)}`);
    console.log(`  ${name.padEnd(22)} = ${fp.toFixed(1)}   [ ${parts.join("  +  ")} ]`);
  }
}
if (DETAIL_WEEK !== null) {
  console.log(`\n(stat-line breakdown above for week ${DETAIL_WEEK}, ${DEF} defense vs ${POS})\n`);
}

const weeks = [...byWeek.keys()].sort((a, b) => a - b);
const gameTotals: number[] = [];
for (const wk of weeks) {
  const g = byWeek.get(wk)!;
  const detail = g.players
    .sort((a, b) => b.fp - a.fp)
    .map((p) => `${p.name} ${p.fp.toFixed(1)}`)
    .join(", ");
  console.log(`Wk ${String(wk).padStart(2)} vs ${g.off}: ${g.total.toFixed(1)}  (${detail})`);
  gameTotals.push(g.total);
}
console.log(`\nGames: ${gameTotals.length}`);
console.log(`Sum of per-game RB points allowed: ${gameTotals.reduce((a, b) => a + b, 0).toFixed(1)}`);
console.log(`Raw FPA = sum / games = ${mean(gameTotals).toFixed(4)}  (rounded -> ${mean(gameTotals).toFixed(1)})`);
