import { Router, type IRouter } from "express";
import { db, nflSchedulesTable, fantasyPointsAllowedTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  GetTeamSosQueryParams,
  GetTeamSosResponse,
  GetPlayerSosQueryParams,
  GetPlayerSosResponse,
  ExportTeamSosCsvQueryParams,
  ExportPlayerSosCsvQueryParams,
} from "@workspace/api-zod";
import { TEAM_FULL_NAMES, TEAM_DIVISIONS, NFL_TEAMS, POSITION_PLAYERS } from "../lib/sos-data";

const router: IRouter = Router();

const CURRENT_WEEK = 1; // Pre-season 2026
const PLAYOFF_WEEKS = [15, 16, 17];

type WeekCell = {
  week: number;
  opponent: string | null;
  isHome: boolean | null;
  isBye: boolean;
  rank: number | null;
  adjustedPoints: number | null;
  difficultyBucket: string | null;
  difficultyScore: number | null;
};

function buildWeekCell(
  week: number,
  schedule: { opponent: string | null; isHome: boolean; isBye: boolean } | undefined,
  fpaMap: Map<string, { rank: number; adjustedPoints: number; difficultyBucket: string }>,
): WeekCell {
  if (!schedule || schedule.isBye) {
    return {
      week,
      opponent: null,
      isHome: null,
      isBye: true,
      rank: null,
      adjustedPoints: null,
      difficultyBucket: null,
      difficultyScore: null,
    };
  }
  const fpa = schedule.opponent ? fpaMap.get(schedule.opponent) : undefined;
  return {
    week,
    opponent: schedule.opponent,
    isHome: schedule.isHome,
    isBye: false,
    rank: fpa?.rank ?? null,
    adjustedPoints: fpa?.adjustedPoints ?? null,
    difficultyBucket: fpa?.difficultyBucket ?? null,
    difficultyScore: fpa ? (33 - fpa.rank) : null,
  };
}

function computeRosScore(cells: WeekCell[], currentWeek: number): number {
  const relevant = cells.filter(c => c.week >= currentWeek && !c.isBye);
  if (relevant.length === 0) return 16;
  const avg = relevant.reduce((sum, c) => sum + (c.rank ?? 16), 0) / relevant.length;
  return Math.round(avg * 10) / 10;
}

function computePlayoffScore(cells: WeekCell[]): number {
  const relevant = cells.filter(c => PLAYOFF_WEEKS.includes(c.week) && !c.isBye);
  if (relevant.length === 0) return 16;
  const avg = relevant.reduce((sum, c) => sum + (c.rank ?? 16), 0) / relevant.length;
  return Math.round(avg * 10) / 10;
}

router.get("/sos/teams", async (req, res): Promise<void> => {
  const parsed = GetTeamSosQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { season, position, scoring, view, metric } = parsed.data as {
    season: number;
    position: string;
    scoring: string;
    view: string;
    metric: string;
  };

  // Fetch all schedule data
  const schedules = await db
    .select()
    .from(nflSchedulesTable)
    .where(eq(nflSchedulesTable.season, season));

  // Fetch FPA data for the position/scoring
  const fpaRows = await db
    .select()
    .from(fantasyPointsAllowedTable)
    .where(
      and(
        eq(fantasyPointsAllowedTable.position, position),
        eq(fantasyPointsAllowedTable.scoringFormat, scoring),
      )
    );

  // Build FPA map: defenseTeam -> { rank, adjustedPoints, difficultyBucket }
  const fpaMap = new Map<string, { rank: number; adjustedPoints: number; difficultyBucket: string }>();
  for (const row of fpaRows) {
    fpaMap.set(row.defenseTeam, {
      rank: row.rank,
      adjustedPoints: row.adjustedPointsAllowed,
      difficultyBucket: row.difficultyBucket,
    });
  }

  // Build schedule map: team -> week -> game
  const scheduleMap = new Map<string, Map<number, { opponent: string | null; isHome: boolean; isBye: boolean }>>();
  for (const game of schedules) {
    if (!scheduleMap.has(game.team)) {
      scheduleMap.set(game.team, new Map());
    }
    scheduleMap.get(game.team)!.set(game.week, {
      opponent: game.opponent,
      isHome: game.isHome,
      isBye: game.isBye,
    });
  }

  // Build rows for all teams
  const teamRows = NFL_TEAMS.map(team => {
    const teamSchedule = scheduleMap.get(team) ?? new Map();
    const weeks: WeekCell[] = [];

    for (let w = 1; w <= 18; w++) {
      const game = teamSchedule.get(w);
      weeks.push(buildWeekCell(w, game, fpaMap));
    }

    const playoff2 = buildWeekCell(15, teamSchedule.get(15), fpaMap);
    const playoff3 = buildWeekCell(17, teamSchedule.get(17), fpaMap);

    const rosScore = computeRosScore(weeks, CURRENT_WEEK);
    const playoffScore = computePlayoffScore(weeks);
    const overallScore = computeRosScore(weeks, 1);

    return {
      team,
      teamFullName: TEAM_FULL_NAMES[team] ?? team,
      division: TEAM_DIVISIONS[team] ?? "",
      weeks,
      playoff2,
      playoff3,
      rosSummary: rosScore,
      _overallScore: overallScore,
      _rosScore: rosScore,
      _playoffScore: playoffScore,
    };
  });

  // Rank teams (lower avg rank = harder schedule = higher overall rank)
  const sortedByOverall = [...teamRows].sort((a, b) => a._overallScore - b._overallScore);
  const sortedByRos = [...teamRows].sort((a, b) => a._rosScore - b._rosScore);
  const sortedByPlayoff = [...teamRows].sort((a, b) => a._playoffScore - b._playoffScore);

  const overallRankMap = new Map<string, number>();
  const rosRankMap = new Map<string, number>();
  const playoffRankMap = new Map<string, number>();

  sortedByOverall.forEach((r, i) => overallRankMap.set(r.team, i + 1));
  sortedByRos.forEach((r, i) => rosRankMap.set(r.team, i + 1));
  sortedByPlayoff.forEach((r, i) => playoffRankMap.set(r.team, i + 1));

  // Apply view filter
  let filteredTeamRows = teamRows.map(row => {
    let filteredWeeks = row.weeks;
    if (view === "REST_OF_SEASON") {
      filteredWeeks = row.weeks.filter(w => w.week >= CURRENT_WEEK);
    } else if (view === "PLAYOFFS") {
      filteredWeeks = row.weeks.filter(w => PLAYOFF_WEEKS.includes(w.week));
    }

    return {
      team: row.team,
      teamFullName: row.teamFullName,
      division: row.division,
      overallRank: overallRankMap.get(row.team) ?? 0,
      rosRank: rosRankMap.get(row.team) ?? 0,
      playoffRank: playoffRankMap.get(row.team) ?? 0,
      weeks: filteredWeeks,
      playoff2: row.playoff2,
      playoff3: row.playoff3,
      rosSummary: row.rosSummary ?? null,
    };
  });

  // Sort by overall rank
  filteredTeamRows = filteredTeamRows.sort((a, b) => a.overallRank - b.overallRank);

  const response = {
    season,
    position,
    scoring,
    currentWeek: CURRENT_WEEK,
    rows: filteredTeamRows,
  };

  res.json(GetTeamSosResponse.parse(response));
});

router.get("/sos/players", async (req, res): Promise<void> => {
  const parsed = GetPlayerSosQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { season, position, scoring, view } = parsed.data as {
    season: number;
    position: string;
    scoring: string;
    view: string;
    metric: string;
  };

  const players = POSITION_PLAYERS[position] ?? [];

  // Fetch schedules
  const teams = [...new Set(players.map(p => p.team))];
  const schedules = await db
    .select()
    .from(nflSchedulesTable)
    .where(
      and(
        eq(nflSchedulesTable.season, season),
        inArray(nflSchedulesTable.team, teams)
      )
    );

  // Fetch FPA data
  const fpaRows = await db
    .select()
    .from(fantasyPointsAllowedTable)
    .where(
      and(
        eq(fantasyPointsAllowedTable.position, position),
        eq(fantasyPointsAllowedTable.scoringFormat, scoring),
      )
    );

  const fpaMap = new Map<string, { rank: number; adjustedPoints: number; difficultyBucket: string }>();
  for (const row of fpaRows) {
    fpaMap.set(row.defenseTeam, {
      rank: row.rank,
      adjustedPoints: row.adjustedPointsAllowed,
      difficultyBucket: row.difficultyBucket,
    });
  }

  // Build schedule map
  const scheduleMap = new Map<string, Map<number, { opponent: string | null; isHome: boolean; isBye: boolean }>>();
  for (const game of schedules) {
    if (!scheduleMap.has(game.team)) {
      scheduleMap.set(game.team, new Map());
    }
    scheduleMap.get(game.team)!.set(game.week, {
      opponent: game.opponent,
      isHome: game.isHome,
      isBye: game.isBye,
    });
  }

  const playerRows = players.map(player => {
    const teamSchedule = scheduleMap.get(player.team) ?? new Map();
    const weeks: WeekCell[] = [];

    for (let w = 1; w <= 18; w++) {
      const game = teamSchedule.get(w);
      weeks.push(buildWeekCell(w, game, fpaMap));
    }

    const playoff2 = buildWeekCell(15, teamSchedule.get(15), fpaMap);
    const playoff3 = buildWeekCell(17, teamSchedule.get(17), fpaMap);

    const rosScore = computeRosScore(weeks, CURRENT_WEEK);
    const playoffScore = computePlayoffScore(weeks);
    const overallScore = computeRosScore(weeks, 1);

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      team: player.team,
      position,
      weeks,
      playoff2,
      playoff3,
      _overallScore: overallScore,
      _rosScore: rosScore,
      _playoffScore: playoffScore,
    };
  });

  // Rank players
  const sortedByOverall = [...playerRows].sort((a, b) => a._overallScore - b._overallScore);
  const sortedByRos = [...playerRows].sort((a, b) => a._rosScore - b._rosScore);
  const sortedByPlayoff = [...playerRows].sort((a, b) => a._playoffScore - b._playoffScore);

  const overallRankMap = new Map<string, number>();
  const rosRankMap = new Map<string, number>();
  const playoffRankMap = new Map<string, number>();

  sortedByOverall.forEach((r, i) => overallRankMap.set(r.playerId, i + 1));
  sortedByRos.forEach((r, i) => rosRankMap.set(r.playerId, i + 1));
  sortedByPlayoff.forEach((r, i) => playoffRankMap.set(r.playerId, i + 1));

  let filteredPlayerRows = playerRows.map(row => {
    let filteredWeeks = row.weeks;
    if (view === "REST_OF_SEASON") {
      filteredWeeks = row.weeks.filter(w => w.week >= CURRENT_WEEK);
    } else if (view === "PLAYOFFS") {
      filteredWeeks = row.weeks.filter(w => PLAYOFF_WEEKS.includes(w.week));
    }

    return {
      playerId: row.playerId,
      playerName: row.playerName,
      team: row.team,
      position,
      sosRank: overallRankMap.get(row.playerId) ?? 0,
      playoffSosRank: playoffRankMap.get(row.playerId) ?? 0,
      rosSosRank: rosRankMap.get(row.playerId) ?? 0,
      weeks: filteredWeeks,
      playoff2: row.playoff2,
      playoff3: row.playoff3,
    };
  });

  filteredPlayerRows = filteredPlayerRows.sort((a, b) => a.sosRank - b.sosRank);

  const response = {
    season,
    position,
    scoring,
    currentWeek: CURRENT_WEEK,
    rows: filteredPlayerRows,
  };

  res.json(GetPlayerSosResponse.parse(response));
});

router.get("/sos/export/teams", async (req, res): Promise<void> => {
  const parsed = ExportTeamSosCsvQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { season, position, scoring } = parsed.data as {
    season: number;
    position: string;
    scoring: string;
    metric: string;
  };

  const schedules = await db
    .select()
    .from(nflSchedulesTable)
    .where(eq(nflSchedulesTable.season, season));

  const fpaRows = await db
    .select()
    .from(fantasyPointsAllowedTable)
    .where(
      and(
        eq(fantasyPointsAllowedTable.position, position),
        eq(fantasyPointsAllowedTable.scoringFormat, scoring),
      )
    );

  const fpaMap = new Map<string, { rank: number; adjustedPoints: number; difficultyBucket: string }>();
  for (const row of fpaRows) {
    fpaMap.set(row.defenseTeam, { rank: row.rank, adjustedPoints: row.adjustedPointsAllowed, difficultyBucket: row.difficultyBucket });
  }

  const scheduleMap = new Map<string, Map<number, { opponent: string | null; isHome: boolean; isBye: boolean }>>();
  for (const game of schedules) {
    if (!scheduleMap.has(game.team)) scheduleMap.set(game.team, new Map());
    scheduleMap.get(game.team)!.set(game.week, { opponent: game.opponent, isHome: game.isHome, isBye: game.isBye });
  }

  const headers = ["Team", ...Array.from({ length: 18 }, (_, i) => `W${i + 1}`), "PO2", "PO3"];
  const rows = NFL_TEAMS.map(team => {
    const ts = scheduleMap.get(team) ?? new Map();
    const cells = Array.from({ length: 18 }, (_, i) => {
      const g = ts.get(i + 1);
      if (!g || g.isBye) return "BYE";
      const fpa = g.opponent ? fpaMap.get(g.opponent) : undefined;
      return `${g.isHome ? "vs." : "@"}${g.opponent ?? ""}(${fpa?.rank ?? "?"})`;
    });
    const po2 = ts.get(15);
    const po3 = ts.get(17);
    const fmtGame = (g: typeof po2) => {
      if (!g || g.isBye) return "BYE";
      const fpa = g.opponent ? fpaMap.get(g.opponent) : undefined;
      return `${g.isHome ? "vs." : "@"}${g.opponent ?? ""}(${fpa?.rank ?? "?"})`;
    };
    return [team, ...cells, fmtGame(po2), fmtGame(po3)];
  });

  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="team-sos-${season}-${position}-${scoring}.csv"`);
  res.send(csv);
});

router.get("/sos/export/players", async (req, res): Promise<void> => {
  const parsed = ExportPlayerSosCsvQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { season, position, scoring } = parsed.data as {
    season: number;
    position: string;
    scoring: string;
    metric: string;
  };

  const players = POSITION_PLAYERS[position] ?? [];
  const teams = [...new Set(players.map(p => p.team))];

  const schedules = await db
    .select()
    .from(nflSchedulesTable)
    .where(and(eq(nflSchedulesTable.season, season), inArray(nflSchedulesTable.team, teams)));

  const fpaRows = await db
    .select()
    .from(fantasyPointsAllowedTable)
    .where(and(eq(fantasyPointsAllowedTable.position, position), eq(fantasyPointsAllowedTable.scoringFormat, scoring)));

  const fpaMap = new Map<string, { rank: number }>();
  for (const row of fpaRows) fpaMap.set(row.defenseTeam, { rank: row.rank });

  const scheduleMap = new Map<string, Map<number, { opponent: string | null; isHome: boolean; isBye: boolean }>>();
  for (const game of schedules) {
    if (!scheduleMap.has(game.team)) scheduleMap.set(game.team, new Map());
    scheduleMap.get(game.team)!.set(game.week, { opponent: game.opponent, isHome: game.isHome, isBye: game.isBye });
  }

  const headers = ["Player", "Team", "Position", ...Array.from({ length: 18 }, (_, i) => `W${i + 1}`), "PO2", "PO3"];
  const rows = players.map(player => {
    const ts = scheduleMap.get(player.team) ?? new Map();
    const cells = Array.from({ length: 18 }, (_, i) => {
      const g = ts.get(i + 1);
      if (!g || g.isBye) return "BYE";
      const fpa = g.opponent ? fpaMap.get(g.opponent) : undefined;
      return `${g.isHome ? "vs." : "@"}${g.opponent ?? ""}(${fpa?.rank ?? "?"})`;
    });
    const po2 = ts.get(15);
    const po3 = ts.get(17);
    const fmtGame = (g: typeof po2) => {
      if (!g || g.isBye) return "BYE";
      const fpa = g.opponent ? fpaMap.get(g.opponent) : undefined;
      return `${g.isHome ? "vs." : "@"}${g.opponent ?? ""}(${fpa?.rank ?? "?"})`;
    };
    return [player.playerName, player.team, position, ...cells, fmtGame(po2), fmtGame(po3)];
  });

  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="player-sos-${season}-${position}-${scoring}.csv"`);
  res.send(csv);
});

export default router;
