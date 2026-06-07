import { Router, type IRouter } from "express";
import { db, nflSchedulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { GetScheduleQueryParams, GetScheduleResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/schedule", async (req, res): Promise<void> => {
  const parsed = GetScheduleQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { season, team } = parsed.data as { season: number; team?: string };

  let query = db
    .select()
    .from(nflSchedulesTable)
    .where(eq(nflSchedulesTable.season, season));

  const schedules = await (team
    ? db.select().from(nflSchedulesTable).where(
        and(
          eq(nflSchedulesTable.season, season),
          eq(nflSchedulesTable.team, team)
        )
      )
    : query);

  const games = schedules.map(g => ({
    week: g.week,
    team: g.team,
    opponent: g.opponent ?? null,
    isHome: g.isHome,
    isBye: g.isBye,
    gameDate: g.gameDate ?? null,
  }));

  res.json(GetScheduleResponse.parse({ season, games }));
});

export default router;
