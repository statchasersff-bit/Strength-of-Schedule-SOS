#!/usr/bin/env python3
"""Build StatChasers Strength-of-Schedule JSON files.

Data source: nflverse via the ``nflreadpy`` package.

For the 2026 preseason we use:

  * the 2026 NFL schedule (opponents per team/week), and
  * 2025 weekly player stats as the defensive baseline.

From those we compute opponent-adjusted fantasy points allowed (FPA) by
defense and position, rank the defenses, then map every team's 2026
schedule onto those ranks. The output JSON matches the response shapes the
React frontend already consumes (see ``lib/api-client-react`` schemas):
``TeamSosResponse``, ``PlayerSosResponse``, ``FpaResponse``,
``ScheduleResponse`` and ``InsightsResponse``.

Once the 2026 season is under way, blend 2026 results into the baseline by
adding 2026 to ``BASELINE_SEASONS`` (recent weeks dominate naturally as the
sample grows).

Usage:
    python scripts/build_sos.py
    SOS_OUTPUT_DIR=public/data/sos python scripts/build_sos.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

try:
    import nflreadpy as nfl
except ImportError:  # pragma: no cover - surfaced clearly in CI
    print(
        "ERROR: nflreadpy is not installed. Run "
        "`pip install -r scripts/requirements.txt`.",
        file=sys.stderr,
    )
    raise

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SEASON = int(os.environ.get("SOS_SEASON", "2026"))
# Seasons used to build the defensive baseline. Preseason = prior year only;
# once 2026 games exist, set SOS_BASELINE_SEASONS="2025,2026".
BASELINE_SEASONS = [
    int(s) for s in os.environ.get("SOS_BASELINE_SEASONS", "2025").split(",") if s
]

# Default to the artifact's public dir so Vite serves the files at
# `/data/sos/...` during dev/preview. Override with SOS_OUTPUT_DIR (the CI
# workflow points this at the dir that gets uploaded to WordPress).
DEFAULT_OUTPUT_DIR = (
    Path(__file__).resolve().parent.parent
    / "artifacts"
    / "statchasers-sos"
    / "public"
    / "data"
    / "sos"
)
OUTPUT_DIR = Path(os.environ.get("SOS_OUTPUT_DIR", str(DEFAULT_OUTPUT_DIR)))

POSITIONS = ["QB", "RB", "WR", "TE"]

# scoring key -> (label, per-reception points, filename slug)
SCORINGS = {
    "PPR": (1.0, "ppr"),
    "HALF_PPR": (0.5, "half-ppr"),
    "STANDARD": (0.0, "std"),
}

REGULAR_SEASON_WEEKS = list(range(1, 19))  # weeks 1-18
FANTASY_PLAYOFF_WEEKS = [15, 16, 17]

# How many players to include per position in the player matrix.
PLAYERS_PER_POSITION = 40

# ---------------------------------------------------------------------------
# Team metadata
# ---------------------------------------------------------------------------

TEAM_META: dict[str, tuple[str, str]] = {
    "ARI": ("Arizona Cardinals", "NFC West"),
    "ATL": ("Atlanta Falcons", "NFC South"),
    "BAL": ("Baltimore Ravens", "AFC North"),
    "BUF": ("Buffalo Bills", "AFC East"),
    "CAR": ("Carolina Panthers", "NFC South"),
    "CHI": ("Chicago Bears", "NFC North"),
    "CIN": ("Cincinnati Bengals", "AFC North"),
    "CLE": ("Cleveland Browns", "AFC North"),
    "DAL": ("Dallas Cowboys", "NFC East"),
    "DEN": ("Denver Broncos", "AFC West"),
    "DET": ("Detroit Lions", "NFC North"),
    "GB": ("Green Bay Packers", "NFC North"),
    "HOU": ("Houston Texans", "AFC South"),
    "IND": ("Indianapolis Colts", "AFC South"),
    "JAX": ("Jacksonville Jaguars", "AFC South"),
    "KC": ("Kansas City Chiefs", "AFC West"),
    "LV": ("Las Vegas Raiders", "AFC West"),
    "LAC": ("Los Angeles Chargers", "AFC West"),
    "LAR": ("Los Angeles Rams", "NFC West"),
    "MIA": ("Miami Dolphins", "AFC East"),
    "MIN": ("Minnesota Vikings", "NFC North"),
    "NE": ("New England Patriots", "AFC East"),
    "NO": ("New Orleans Saints", "NFC South"),
    "NYG": ("New York Giants", "NFC East"),
    "NYJ": ("New York Jets", "AFC East"),
    "PHI": ("Philadelphia Eagles", "NFC East"),
    "PIT": ("Pittsburgh Steelers", "AFC North"),
    "SF": ("San Francisco 49ers", "NFC West"),
    "SEA": ("Seattle Seahawks", "NFC West"),
    "TB": ("Tampa Bay Buccaneers", "NFC South"),
    "TEN": ("Tennessee Titans", "AFC South"),
    "WAS": ("Washington Commanders", "NFC East"),
}

# Normalize historical / alternate abbreviations to the keys above.
TEAM_ALIASES = {
    "JAC": "JAX",
    "LA": "LAR",
    "STL": "LAR",
    "SD": "LAC",
    "OAK": "LV",
    "WSH": "WAS",
    "GNB": "GB",
    "KAN": "KC",
    "NWE": "NE",
    "NOR": "NO",
    "SFO": "SF",
    "TAM": "TB",
    "LVR": "LV",
}


def norm_team(abbr: Any) -> str | None:
    if abbr is None or (isinstance(abbr, float) and pd.isna(abbr)):
        return None
    a = str(abbr).strip().upper()
    a = TEAM_ALIASES.get(a, a)
    return a if a in TEAM_META else None


# ---------------------------------------------------------------------------
# Difficulty buckets
# ---------------------------------------------------------------------------
# rank 1 = the defense allowing the FEWEST adjusted points = toughest matchup.
BUCKETS = ["VERY_TOUGH", "TOUGH", "NEUTRAL", "FAVORABLE", "SMASH_SPOT"]


def bucket_from_rank(rank: int, n: int) -> str:
    """Map a 1..n rank into five roughly-even difficulty buckets.

    rank 1 (fewest points allowed) -> VERY_TOUGH;
    rank n (most points allowed)    -> SMASH_SPOT.
    """
    if n <= 0:
        return "NEUTRAL"
    # 0.0 (toughest) .. ~1.0 (easiest)
    frac = (rank - 1) / max(n - 1, 1)
    idx = min(int(frac * len(BUCKETS)), len(BUCKETS) - 1)
    return BUCKETS[idx]


# ---------------------------------------------------------------------------
# Loading helpers
# ---------------------------------------------------------------------------


def _to_pandas(obj: Any) -> pd.DataFrame:
    """nflreadpy returns Polars frames; normalize to pandas."""
    if isinstance(obj, pd.DataFrame):
        return obj
    to_pandas = getattr(obj, "to_pandas", None)
    if callable(to_pandas):
        return to_pandas()
    return pd.DataFrame(obj)


def first_col(df: pd.DataFrame, *names: str) -> pd.Series:
    """Return the first present column among ``names`` as a numeric series.

    Falls back to a zero series when none of the columns exist (nflverse
    column names drift between releases, so we stay defensive)."""
    for name in names:
        if name in df.columns:
            return pd.to_numeric(df[name], errors="coerce").fillna(0.0)
    return pd.Series(0.0, index=df.index)


def load_schedule(season: int) -> pd.DataFrame:
    sched = _to_pandas(nfl.load_schedules([season]))
    if "season" in sched.columns:
        sched = sched[sched["season"] == season]
    if "game_type" in sched.columns:
        sched = sched[sched["game_type"] == "REG"]
    return sched


def load_player_weeks(seasons: list[int]) -> pd.DataFrame:
    stats = _to_pandas(nfl.load_player_stats(seasons))
    if "season_type" in stats.columns:
        stats = stats[stats["season_type"] == "REG"]
    return stats


def load_team_map(season: int) -> dict[str, str]:
    """player_id -> 2026 team, from rosters when available."""
    mapping: dict[str, str] = {}
    try:
        rosters = _to_pandas(nfl.load_rosters([season]))
    except Exception as exc:  # noqa: BLE001 - rosters may not exist yet
        print(f"  (rosters for {season} unavailable: {exc})")
        return mapping
    id_col = next(
        (c for c in ("player_id", "gsis_id", "pfr_id") if c in rosters.columns),
        None,
    )
    team_col = next(
        (c for c in ("team", "recent_team") if c in rosters.columns), None
    )
    if not id_col or not team_col:
        return mapping
    for pid, team in zip(rosters[id_col], rosters[team_col]):
        t = norm_team(team)
        if pid is not None and not pd.isna(pid) and t:
            mapping[str(pid)] = t
    return mapping


# ---------------------------------------------------------------------------
# Fantasy points
# ---------------------------------------------------------------------------


def fantasy_points(df: pd.DataFrame, reception_pts: float) -> pd.Series:
    """Vectorized fantasy points for a weekly player-stats frame."""
    pass_yds = first_col(df, "passing_yards")
    pass_td = first_col(df, "passing_tds")
    interceptions = first_col(df, "passing_interceptions", "interceptions")
    rush_yds = first_col(df, "rushing_yards")
    rush_td = first_col(df, "rushing_tds")
    rec = first_col(df, "receptions")
    rec_yds = first_col(df, "receiving_yards")
    rec_td = first_col(df, "receiving_tds")
    fumbles_lost = (
        first_col(df, "rushing_fumbles_lost")
        + first_col(df, "receiving_fumbles_lost")
        + first_col(df, "sack_fumbles_lost")
    )
    two_pt = (
        first_col(df, "passing_2pt_conversions")
        + first_col(df, "rushing_2pt_conversions")
        + first_col(df, "receiving_2pt_conversions")
    )

    return (
        pass_yds * 0.04
        + pass_td * 4.0
        - interceptions * 2.0
        + rush_yds * 0.1
        + rush_td * 6.0
        + rec * reception_pts
        + rec_yds * 0.1
        + rec_td * 6.0
        - fumbles_lost * 2.0
        + two_pt * 2.0
    )


def position_group(pos: Any) -> str | None:
    if pos is None or (isinstance(pos, float) and pd.isna(pos)):
        return None
    p = str(pos).strip().upper()
    if p in {"QB"}:
        return "QB"
    if p in {"RB", "FB", "HB"}:
        return "RB"
    if p in {"WR"}:
        return "WR"
    if p in {"TE"}:
        return "TE"
    return None


# ---------------------------------------------------------------------------
# FPA computation
# ---------------------------------------------------------------------------


def compute_fpa(weeks: pd.DataFrame, reception_pts: float) -> dict[str, pd.DataFrame]:
    """Return per-position DataFrames of opponent-adjusted FPA.

    Each frame is indexed by defense team with columns: raw, adjusted, rank,
    bucket. rank 1 = fewest adjusted points allowed (toughest).
    """
    df = weeks.copy()
    off_col = next(
        (c for c in ("team", "recent_team", "posteam") if c in df.columns), None
    )
    opp_col = next(
        (c for c in ("opponent_team", "defteam", "opponent") if c in df.columns),
        None,
    )
    if off_col is None or opp_col is None:
        raise RuntimeError(
            "player stats missing team/opponent columns: "
            f"{sorted(df.columns)[:30]}..."
        )

    df["pos_g"] = df["position"].map(position_group) if "position" in df else None
    df = df[df["pos_g"].notna()].copy()
    df["off"] = df[off_col].map(norm_team)
    df["deff"] = df[opp_col].map(norm_team)
    df["week"] = first_col(df, "week").astype(int)
    df = df[df["off"].notna() & df["deff"].notna()]
    df["fp"] = fantasy_points(df, reception_pts)

    # One row per (offense, defense, position, week): points that offense
    # produced against that defense at that position.
    g = (
        df.groupby(["off", "deff", "pos_g", "week"], as_index=False)["fp"].sum()
    )

    out: dict[str, pd.DataFrame] = {}
    for pos in POSITIONS:
        gp = g[g["pos_g"] == pos].copy()
        if gp.empty:
            out[pos] = pd.DataFrame(
                columns=["raw", "adjusted", "rank", "bucket"]
            )
            continue

        # Offensive strength: each offense's per-game output at this position.
        off_avg = gp.groupby("off")["fp"].mean().rename("off_avg")
        league_avg = float(gp["fp"].mean())
        gp = gp.join(off_avg, on="off")
        # Subtract how much stronger/weaker than league-average each offense
        # was, so defenses are not penalized for facing elite offenses.
        gp["adj"] = gp["fp"] - (gp["off_avg"] - league_avg)

        agg = gp.groupby("deff").agg(
            raw=("fp", "mean"), adjusted=("adj", "mean")
        )
        agg = agg.sort_values("adjusted")  # ascending: toughest first
        agg["rank"] = range(1, len(agg) + 1)
        n = len(agg)
        agg["bucket"] = [bucket_from_rank(r, n) for r in agg["rank"]]
        out[pos] = agg

    return out


# ---------------------------------------------------------------------------
# Schedule helpers
# ---------------------------------------------------------------------------


def build_opponent_map(sched: pd.DataFrame) -> dict[str, dict[int, tuple[str, bool]]]:
    """team -> {week -> (opponent, is_home)} for the regular season."""
    out: dict[str, dict[int, tuple[str, bool]]] = {t: {} for t in TEAM_META}
    for _, row in sched.iterrows():
        week = int(row["week"]) if not pd.isna(row.get("week")) else None
        home = norm_team(row.get("home_team"))
        away = norm_team(row.get("away_team"))
        if week is None or home is None or away is None:
            continue
        out[home][week] = (away, True)
        out[away][week] = (home, False)
    return out


def game_dates(sched: pd.DataFrame) -> dict[tuple[str, int], str]:
    dates: dict[tuple[str, int], str] = {}
    date_col = next(
        (c for c in ("gameday", "game_date", "gametime") if c in sched.columns),
        None,
    )
    if date_col is None:
        return dates
    for _, row in sched.iterrows():
        week = int(row["week"]) if not pd.isna(row.get("week")) else None
        d = row.get(date_col)
        if week is None or d is None or pd.isna(d):
            continue
        home, away = norm_team(row.get("home_team")), norm_team(row.get("away_team"))
        for t in (home, away):
            if t:
                dates[(t, week)] = str(d)
    return dates


# ---------------------------------------------------------------------------
# Cell builders
# ---------------------------------------------------------------------------


def round1(x: float) -> float:
    return round(float(x), 1)


def week_cell(week: int, opp: str | None, is_home: bool | None, fpa: pd.DataFrame) -> dict:
    if opp is None:
        return {
            "week": week,
            "opponent": None,
            "isHome": None,
            "isBye": True,
            "rank": None,
            "adjustedPoints": None,
            "difficultyBucket": None,
            "difficultyScore": None,
        }
    if opp in fpa.index:
        row = fpa.loc[opp]
        return {
            "week": week,
            "opponent": opp,
            "isHome": bool(is_home),
            "isBye": False,
            "rank": int(row["rank"]),
            "adjustedPoints": round1(row["adjusted"]),
            "difficultyBucket": str(row["bucket"]),
            "difficultyScore": round1(row["adjusted"]),
        }
    return {
        "week": week,
        "opponent": opp,
        "isHome": bool(is_home),
        "isBye": False,
        "rank": None,
        "adjustedPoints": None,
        "difficultyBucket": "NEUTRAL",
        "difficultyScore": None,
    }


def aggregate_cell(
    weeks: list[int],
    schedule: dict[int, tuple[str, bool]],
    fpa: pd.DataFrame,
    all_team_avgs: dict[str, float],
    team: str,
    label_week: int,
) -> dict | None:
    """A synthetic WeekCell summarizing a multi-week playoff stretch."""
    vals = []
    for w in weeks:
        game = schedule.get(w)
        if game and game[0] in fpa.index:
            vals.append(float(fpa.loc[game[0], "adjusted"]))
    if not vals:
        return None
    avg = sum(vals) / len(vals)
    # Rank this team's playoff-stretch average against every team's.
    ranked = sorted(all_team_avgs.items(), key=lambda kv: kv[1])
    rank = next((i + 1 for i, (t, _) in enumerate(ranked) if t == team), None)
    n = len(ranked)
    return {
        "week": label_week,
        "opponent": None,
        "isHome": None,
        "isBye": False,
        "rank": rank,
        "adjustedPoints": round1(avg),
        "difficultyBucket": bucket_from_rank(rank, n) if rank else "NEUTRAL",
        "difficultyScore": round1(avg),
    }


def avg_over(weeks: list[int], schedule: dict[int, tuple[str, bool]], fpa: pd.DataFrame) -> float | None:
    vals = [
        float(fpa.loc[schedule[w][0], "adjusted"])
        for w in weeks
        if w in schedule and schedule[w][0] in fpa.index
    ]
    return sum(vals) / len(vals) if vals else None


def dense_rank_desc(values: dict[str, float]) -> dict[str, int]:
    """Rank keys 1..n by value descending (highest value -> rank 1).

    Highest average opponent points allowed = easiest schedule = rank 1.
    """
    ordered = sorted(values.items(), key=lambda kv: kv[1], reverse=True)
    return {k: i + 1 for i, (k, _) in enumerate(ordered)}


# ---------------------------------------------------------------------------
# Builders for each output file
# ---------------------------------------------------------------------------


def build_team_sos(
    pos: str,
    scoring: str,
    fpa: pd.DataFrame,
    opp_map: dict[str, dict[int, tuple[str, bool]]],
    current_week: int,
) -> dict:
    # Full-season and playoff averages per team (for ranking columns).
    full_avgs: dict[str, float] = {}
    ros_avgs: dict[str, float] = {}
    playoff_avgs: dict[str, float] = {}
    ros_weeks = [w for w in REGULAR_SEASON_WEEKS if w >= current_week]
    for team, sched in opp_map.items():
        full = avg_over(REGULAR_SEASON_WEEKS, sched, fpa)
        ros = avg_over(ros_weeks, sched, fpa)
        po = avg_over(FANTASY_PLAYOFF_WEEKS, sched, fpa)
        full_avgs[team] = full if full is not None else 0.0
        ros_avgs[team] = ros if ros is not None else 0.0
        playoff_avgs[team] = po if po is not None else 0.0

    overall_rank = dense_rank_desc(full_avgs)
    ros_rank = dense_rank_desc(ros_avgs)
    playoff_rank = dense_rank_desc(playoff_avgs)

    rows = []
    for team in sorted(TEAM_META):
        sched = opp_map.get(team, {})
        weeks_cells = []
        for w in REGULAR_SEASON_WEEKS:
            game = sched.get(w)
            if game is None:
                weeks_cells.append(week_cell(w, None, None, fpa))
            else:
                weeks_cells.append(week_cell(w, game[0], game[1], fpa))
        name, division = TEAM_META[team]
        rows.append(
            {
                "team": team,
                "teamFullName": name,
                "division": division,
                "overallRank": overall_rank[team],
                "rosRank": ros_rank[team],
                "playoffRank": playoff_rank[team],
                "weeks": weeks_cells,
                "playoff2": aggregate_cell(
                    [16, 17], sched, fpa, playoff_avgs, team, 16
                ),
                "playoff3": aggregate_cell(
                    FANTASY_PLAYOFF_WEEKS, sched, fpa, playoff_avgs, team, 17
                ),
                "rosSummary": round1(ros_avgs[team]),
            }
        )

    # Sort by overall rank so the table reads easiest -> hardest.
    rows.sort(key=lambda r: r["overallRank"])
    return {
        "season": SEASON,
        "position": pos,
        "scoring": scoring,
        "currentWeek": current_week,
        "rows": rows,
    }


def top_players(weeks: pd.DataFrame, reception_pts: float) -> dict[str, list[dict]]:
    """Top N players per position by total fantasy points in the baseline."""
    df = weeks.copy()
    df["pos_g"] = df["position"].map(position_group) if "position" in df else None
    df = df[df["pos_g"].notna()].copy()
    df["fp"] = fantasy_points(df, reception_pts)

    id_col = next(
        (c for c in ("player_id", "gsis_id", "player_gsis_id") if c in df.columns),
        None,
    )
    name_col = next(
        (
            c
            for c in ("player_display_name", "player_name", "full_name")
            if c in df.columns
        ),
        None,
    )
    team_col = next(
        (c for c in ("team", "recent_team") if c in df.columns), None
    )
    if id_col is None or name_col is None:
        return {p: [] for p in POSITIONS}

    df["pid"] = df[id_col].astype(str)
    grouped = df.groupby(["pid", "pos_g"]).agg(
        name=(name_col, "last"),
        team=(team_col, "last") if team_col else (id_col, "last"),
        total=("fp", "sum"),
    )
    grouped = grouped.reset_index()

    result: dict[str, list[dict]] = {}
    for pos in POSITIONS:
        gp = grouped[grouped["pos_g"] == pos].sort_values(
            "total", ascending=False
        ).head(PLAYERS_PER_POSITION)
        result[pos] = [
            {
                "playerId": r["pid"],
                "playerName": str(r["name"]),
                "baselineTeam": norm_team(r["team"]) if team_col else None,
            }
            for _, r in gp.iterrows()
        ]
    return result


def build_player_sos(
    pos: str,
    scoring: str,
    fpa: pd.DataFrame,
    opp_map: dict[str, dict[int, tuple[str, bool]]],
    players: list[dict],
    team_map: dict[str, str],
    current_week: int,
) -> dict:
    ros_weeks = [w for w in REGULAR_SEASON_WEEKS if w >= current_week]

    # Compute team-level averages once (shared by all players on a team).
    team_full = {t: (avg_over(REGULAR_SEASON_WEEKS, s, fpa) or 0.0) for t, s in opp_map.items()}
    team_ros = {t: (avg_over(ros_weeks, s, fpa) or 0.0) for t, s in opp_map.items()}
    team_po = {t: (avg_over(FANTASY_PLAYOFF_WEEKS, s, fpa) or 0.0) for t, s in opp_map.items()}

    enriched = []
    for p in players:
        team = team_map.get(p["playerId"]) or p.get("baselineTeam")
        if not team or team not in opp_map:
            continue
        enriched.append({**p, "team": team})

    sos_values = {p["playerId"]: team_full[p["team"]] for p in enriched}
    ros_values = {p["playerId"]: team_ros[p["team"]] for p in enriched}
    po_values = {p["playerId"]: team_po[p["team"]] for p in enriched}
    sos_rank = dense_rank_desc(sos_values)
    ros_rank = dense_rank_desc(ros_values)
    po_rank = dense_rank_desc(po_values)

    rows = []
    for p in enriched:
        team = p["team"]
        sched = opp_map[team]
        weeks_cells = []
        for w in REGULAR_SEASON_WEEKS:
            game = sched.get(w)
            weeks_cells.append(
                week_cell(w, game[0], game[1], fpa) if game else week_cell(w, None, None, fpa)
            )
        rows.append(
            {
                "playerId": p["playerId"],
                "playerName": p["playerName"],
                "team": team,
                "position": pos,
                "sosRank": sos_rank[p["playerId"]],
                "playoffSosRank": po_rank[p["playerId"]],
                "rosSosRank": ros_rank[p["playerId"]],
                "weeks": weeks_cells,
                "playoff2": aggregate_cell([16, 17], sched, fpa, team_po, team, 16),
                "playoff3": aggregate_cell(
                    FANTASY_PLAYOFF_WEEKS, sched, fpa, team_po, team, 17
                ),
            }
        )

    rows.sort(key=lambda r: r["sosRank"])
    return {
        "season": SEASON,
        "position": pos,
        "scoring": scoring,
        "currentWeek": current_week,
        "rows": rows,
    }


def build_fpa(pos: str, scoring: str, fpa: pd.DataFrame, baseline_season: int) -> dict:
    rows = []
    for team, row in fpa.iterrows():
        rows.append(
            {
                "defenseTeam": team,
                "position": pos,
                "scoringFormat": scoring,
                "rawPointsAllowed": round1(row["raw"]),
                "adjustedPointsAllowed": round1(row["adjusted"]),
                "rank": int(row["rank"]),
                "difficultyBucket": str(row["bucket"]),
            }
        )
    rows.sort(key=lambda r: r["rank"])
    return {
        "season": baseline_season,
        "position": pos,
        "scoring": scoring,
        "rows": rows,
    }


def build_schedule(opp_map: dict[str, dict[int, tuple[str, bool]]], dates: dict) -> dict:
    games = []
    for team in sorted(TEAM_META):
        sched = opp_map.get(team, {})
        for w in REGULAR_SEASON_WEEKS:
            game = sched.get(w)
            if game is None:
                games.append(
                    {
                        "week": w,
                        "team": team,
                        "opponent": None,
                        "isHome": False,
                        "isBye": True,
                        "gameDate": None,
                    }
                )
            else:
                games.append(
                    {
                        "week": w,
                        "team": team,
                        "opponent": game[0],
                        "isHome": bool(game[1]),
                        "isBye": False,
                        "gameDate": dates.get((team, w)),
                    }
                )
    return {"season": SEASON, "games": games}


def build_insights(
    scoring: str,
    team_sos_by_pos: dict[str, dict],
) -> dict:
    """Position-agnostic schedule insight cards from the computed team SOS."""
    # Average each team's full-season and playoff difficulty across positions.
    full: dict[str, list[float]] = {}
    playoff: dict[str, list[float]] = {}
    for pos, data in team_sos_by_pos.items():
        for row in data["rows"]:
            full.setdefault(row["team"], []).append(row["rosSummary"] or 0.0)
            cell = row.get("playoff3")
            if cell and cell.get("adjustedPoints") is not None:
                playoff.setdefault(row["team"], []).append(cell["adjustedPoints"])

    full_avg = {t: sum(v) / len(v) for t, v in full.items() if v}
    po_avg = {t: sum(v) / len(v) for t, v in playoff.items() if v}
    if not full_avg:
        return {"season": SEASON, "scoring": scoring, "cards": []}

    easiest = max(full_avg, key=full_avg.get)
    toughest = min(full_avg, key=full_avg.get)
    best_po = max(po_avg, key=po_avg.get) if po_avg else easiest
    worst_po = min(po_avg, key=po_avg.get) if po_avg else toughest

    def card(cid, title, subtitle, team, value, detail, trend) -> dict:
        return {
            "id": cid,
            "title": title,
            "subtitle": subtitle,
            "value": value,
            "detail": detail,
            "position": "ALL",
            "team": team,
            "trend": trend,
        }

    return {
        "season": SEASON,
        "scoring": scoring,
        "cards": [
            card(
                "easiest-schedule",
                "Easiest Schedule",
                "Full season",
                easiest,
                easiest,
                f"{round1(full_avg[easiest])} adj pts",
                "positive",
            ),
            card(
                "toughest-schedule",
                "Toughest Schedule",
                "Full season",
                toughest,
                toughest,
                f"{round1(full_avg[toughest])} adj pts",
                "negative",
            ),
            card(
                "best-playoff",
                "Best Playoff Slate",
                "Weeks 15-17",
                best_po,
                best_po,
                f"{round1(po_avg.get(best_po, 0.0))} adj pts",
                "positive",
            ),
            card(
                "toughest-playoff",
                "Toughest Playoff Slate",
                "Weeks 15-17",
                worst_po,
                worst_po,
                f"{round1(po_avg.get(worst_po, 0.0))} adj pts",
                "negative",
            ),
        ],
    }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def determine_current_week(sched: pd.DataFrame) -> int:
    """Week 1 in the preseason; otherwise the first not-yet-final week."""
    if "result" not in sched.columns or "week" not in sched.columns:
        return 1
    played = sched[sched["result"].notna()]
    if played.empty:
        return 1
    return min(int(played["week"].max()) + 1, 18)


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"  wrote {path.relative_to(OUTPUT_DIR.parent) if OUTPUT_DIR in path.parents else path}")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output dir: {OUTPUT_DIR}")
    print(f"Loading {SEASON} schedule and {BASELINE_SEASONS} player stats...")

    sched = load_schedule(SEASON)
    weeks = load_player_weeks(BASELINE_SEASONS)
    opp_map = build_opponent_map(sched)
    dates = game_dates(sched)
    team_map = load_team_map(SEASON)
    current_week = determine_current_week(sched)
    print(f"Current week: {current_week}")

    updated_at = datetime.now(timezone.utc).isoformat()
    written_files: list[str] = []

    # Schedule is scoring/position independent.
    schedule_file = f"schedule-{SEASON}.json"
    write_json(OUTPUT_DIR / schedule_file, build_schedule(opp_map, dates))
    written_files.append(schedule_file)

    for scoring, (reception_pts, slug) in SCORINGS.items():
        print(f"Scoring: {scoring}")
        fpa_by_pos = compute_fpa(weeks, reception_pts)
        players_by_pos = top_players(weeks, reception_pts)
        team_sos_by_pos: dict[str, dict] = {}

        for pos in POSITIONS:
            fpa = fpa_by_pos[pos]
            pos_slug = pos.lower()

            team_sos = build_team_sos(pos, scoring, fpa, opp_map, current_week)
            team_sos_by_pos[pos] = team_sos
            team_file = f"team-sos-{SEASON}-{pos_slug}-{slug}.json"
            write_json(OUTPUT_DIR / team_file, team_sos)
            written_files.append(team_file)

            player_sos = build_player_sos(
                pos, scoring, fpa, opp_map, players_by_pos[pos], team_map, current_week
            )
            player_file = f"player-sos-{SEASON}-{pos_slug}-{slug}.json"
            write_json(OUTPUT_DIR / player_file, player_sos)
            written_files.append(player_file)

            fpa_file = f"fpa-{BASELINE_SEASONS[-1]}-{pos_slug}-{slug}.json"
            write_json(
                OUTPUT_DIR / fpa_file,
                build_fpa(pos, scoring, fpa, BASELINE_SEASONS[-1]),
            )
            written_files.append(fpa_file)

        insights_file = f"insights-{SEASON}-{slug}.json"
        write_json(OUTPUT_DIR / insights_file, build_insights(scoring, team_sos_by_pos))
        written_files.append(insights_file)

    manifest = {
        "season": SEASON,
        "baselineSeasons": BASELINE_SEASONS,
        "updatedAt": updated_at,
        "currentWeek": current_week,
        "positions": POSITIONS,
        "scoring": list(SCORINGS.keys()),
        "files": sorted(written_files),
    }
    write_json(OUTPUT_DIR / "manifest.json", manifest)
    print(f"Done. {len(written_files) + 1} files written.")


if __name__ == "__main__":
    main()
