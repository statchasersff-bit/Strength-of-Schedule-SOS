import { Router, type IRouter } from "express";
import { db, nflSchedulesTable, fantasyPointsAllowedTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { GetInsightsQueryParams, GetInsightsResponse } from "@workspace/api-zod";
import { NFL_TEAMS, POSITION_PLAYERS } from "../lib/sos-data";

const router: IRouter = Router();

const PLAYOFF_WEEKS = [15, 16, 17];
const CURRENT_WEEK = 1;
const OPENING_WEEKS = [1, 2, 3, 4];

type WeekSummary = {
  team: string;
  avgRank: number;
};

async function computePositionSummaries(
  season: number,
  position: string,
  scoring: string,
  weekFilter: number[]
): Promise<WeekSummary[]> {
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
        eq(fantasyPointsAllowedTable.scoringFormat, scoring)
      )
    );

  const fpaMap = new Map<string, number>();
  for (const row of fpaRows) fpaMap.set(row.defenseTeam, row.rank);

  const scheduleMap = new Map<string, Map<number, { opponent: string | null; isBye: boolean }>>();
  for (const game of schedules) {
    if (!scheduleMap.has(game.team)) scheduleMap.set(game.team, new Map());
    scheduleMap.get(game.team)!.set(game.week, { opponent: game.opponent, isBye: game.isBye });
  }

  const summaries: WeekSummary[] = [];
  for (const team of NFL_TEAMS) {
    const ts = scheduleMap.get(team) ?? new Map();
    const relevant = weekFilter
      .map(w => ts.get(w))
      .filter(g => g && !g.isBye && g.opponent);
    if (relevant.length === 0) continue;
    const ranks = relevant.map(g => fpaMap.get(g!.opponent!) ?? 16);
    const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    summaries.push({ team, avgRank: avg });
  }
  return summaries;
}

router.get("/insights", async (req, res): Promise<void> => {
  const parsed = GetInsightsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { season, scoring } = parsed.data as { season: number; scoring: string };

  const [qbPlayoff, rbPlayoff, rbRos, rbOpening] = await Promise.all([
    computePositionSummaries(season, "QB", scoring, PLAYOFF_WEEKS),
    computePositionSummaries(season, "RB", scoring, PLAYOFF_WEEKS),
    computePositionSummaries(season, "RB", scoring, Array.from({ length: 18 - CURRENT_WEEK + 1 }, (_, i) => i + CURRENT_WEEK)),
    computePositionSummaries(season, "RB", scoring, OPENING_WEEKS),
  ]);

  // Best QB Playoff Schedule: lowest avg rank = easiest schedule
  const bestQbPlayoff = [...qbPlayoff].sort((a, b) => b.avgRank - a.avgRank)[0];
  // Worst RB Playoff Schedule: highest avg rank (hardest)
  const worstRbPlayoff = [...rbPlayoff].sort((a, b) => a.avgRank - b.avgRank)[0];
  // Best ROS Schedule
  const bestRbRos = [...rbRos].sort((a, b) => b.avgRank - a.avgRank)[0];
  // Toughest Opening Stretch
  const toughestOpening = [...rbOpening].sort((a, b) => a.avgRank - b.avgRank)[0];

  const cards = [
    {
      id: "best-qb-playoff",
      title: "Best QB Playoff Schedule",
      subtitle: "Weeks 15-17",
      value: bestQbPlayoff?.team ?? "N/A",
      detail: `Avg rank: ${bestQbPlayoff ? (33 - bestQbPlayoff.avgRank).toFixed(1) : "N/A"} — elite playoff upside`,
      position: "QB",
      team: bestQbPlayoff?.team ?? "N/A",
      trend: "positive" as const,
    },
    {
      id: "worst-rb-playoff",
      title: "Worst RB Playoff Schedule",
      subtitle: "Weeks 15-17",
      value: worstRbPlayoff?.team ?? "N/A",
      detail: `Avg rank: ${worstRbPlayoff ? worstRbPlayoff.avgRank.toFixed(1) : "N/A"} — sell before playoffs`,
      position: "RB",
      team: worstRbPlayoff?.team ?? "N/A",
      trend: "negative" as const,
    },
    {
      id: "best-ros-schedule",
      title: "Best ROS Schedule",
      subtitle: `Weeks ${CURRENT_WEEK}-18`,
      value: bestRbRos?.team ?? "N/A",
      detail: `Avg rank: ${bestRbRos ? (33 - bestRbRos.avgRank).toFixed(1) : "N/A"} — buy before it's too late`,
      position: "RB",
      team: bestRbRos?.team ?? "N/A",
      trend: "positive" as const,
    },
    {
      id: "toughest-opening",
      title: "Toughest Opening Stretch",
      subtitle: "Weeks 1-4",
      value: toughestOpening?.team ?? "N/A",
      detail: `Avg rank: ${toughestOpening ? toughestOpening.avgRank.toFixed(1) : "N/A"} — stream away early`,
      position: "RB",
      team: toughestOpening?.team ?? "N/A",
      trend: "negative" as const,
    },
  ];

  const response = { season, scoring, cards };
  res.json(GetInsightsResponse.parse(response));
});

export default router;
