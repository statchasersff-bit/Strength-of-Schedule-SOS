import { Router, type IRouter } from "express";
import { db, fantasyPointsAllowedTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { GetFantasyPointsAllowedQueryParams, GetFantasyPointsAllowedResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/fpa", async (req, res): Promise<void> => {
  const parsed = GetFantasyPointsAllowedQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { season, position, scoring } = parsed.data as {
    season: number;
    position: string;
    scoring: string;
  };

  const rows = await db
    .select()
    .from(fantasyPointsAllowedTable)
    .where(
      and(
        eq(fantasyPointsAllowedTable.season, season),
        eq(fantasyPointsAllowedTable.position, position),
        eq(fantasyPointsAllowedTable.scoringFormat, scoring)
      )
    );

  const fpaRows = rows.map(r => ({
    defenseTeam: r.defenseTeam,
    position: r.position,
    scoringFormat: r.scoringFormat,
    rawPointsAllowed: r.rawPointsAllowed,
    adjustedPointsAllowed: r.adjustedPointsAllowed,
    rank: r.rank,
    difficultyBucket: r.difficultyBucket as "VERY_TOUGH" | "TOUGH" | "NEUTRAL" | "FAVORABLE" | "SMASH_SPOT",
  }));

  res.json(GetFantasyPointsAllowedResponse.parse({ season, position, scoring, rows: fpaRows }));
});

export default router;
