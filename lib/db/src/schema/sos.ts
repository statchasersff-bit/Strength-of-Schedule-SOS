import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  serial,
  unique,
} from "drizzle-orm/pg-core";

export const nflSchedulesTable = pgTable(
  "nfl_schedules",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    team: text("team").notNull(),
    opponent: text("opponent"),
    isHome: boolean("is_home").notNull().default(false),
    isBye: boolean("is_bye").notNull().default(false),
    gameDate: text("game_date"),
  },
  (t) => [unique("nfl_schedules_season_week_team").on(t.season, t.week, t.team)]
);

export const fantasyPointsAllowedTable = pgTable(
  "fantasy_points_allowed",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    defenseTeam: text("defense_team").notNull(),
    position: text("position").notNull(),
    scoringFormat: text("scoring_format").notNull(),
    rawPointsAllowed: real("raw_points_allowed").notNull(),
    adjustedPointsAllowed: real("adjusted_points_allowed").notNull(),
    rank: integer("rank").notNull(),
    difficultyBucket: text("difficulty_bucket").notNull(),
  },
  (t) => [
    unique("fpa_season_team_pos_scoring").on(
      t.season,
      t.defenseTeam,
      t.position,
      t.scoringFormat
    ),
  ]
);

export type NflSchedule = typeof nflSchedulesTable.$inferSelect;
export type FantasyPointsAllowed = typeof fantasyPointsAllowedTable.$inferSelect;
