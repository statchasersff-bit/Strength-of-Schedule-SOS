# Strength-of-Schedule data pipeline

The SOS app (`artifacts/statchasers-sos`) reads **static JSON** — there is no
live API. The JSON is pre-built from nflverse data by a two-stage TypeScript
pipeline and hosted as flat files.

## How it fits together

```
nflverse released CSVs
  (stats_player_week, games, rosters)
        │
        ▼
scripts/src/fpa-ingest.ts ──►  data/fpa-snapshots/fpa-snapshot-<season>-<scoring>.json
   (canonical aFPA calc)        + public/data/sos/fpa-<season>-<pos>-<scoring>.json
        │
        ▼
scripts/src/build-sos.ts  ──►  public/data/sos/{team-sos,player-sos,schedule,insights,manifest}.json
   (maps schedule → opponent
    defense aFPA; never
    recomputes aFPA)
        │                              │
   (GitHub Actions:                    ▼
   update-sos.yml, every 3 days)  Vite serves them at /data/sos/...
                                       │
                                       ▼
                      src/lib/sos-client.ts fetches per filter
                      (e.g. team-sos-2026-rb-ppr.json)
```

## Stage 1 — `fpa-ingest.ts` (the source of truth for aFPA)

For each **defense × position × scoring format**, from the baseline season's
weekly player stats:

- `raw` = total fantasy points allowed to that position ÷ games played
- `offPpg[team]` = each offense's per-game fantasy output at that position
- `leagueAvg` = mean `offPpg` across all teams for that position
- `SOS` = average `offPpg` of the offenses that defense actually faced
  (repeat opponents counted per meeting; unknown → `leagueAvg`)
- `adj` = `raw - (SOS - leagueAvg)`

Defenses are ranked by `adj` **ascending** (rank 1 = toughest, 32 = easiest)
and bucketed by fixed rank thresholds:

| Rank  | Bucket       |
| ----- | ------------ |
| 1–5   | `VERY_TOUGH` |
| 6–10  | `TOUGH`      |
| 11–22 | `NEUTRAL`    |
| 23–27 | `FAVORABLE`  |
| 28–32 | `SMASH_SPOT` |

Output: `data/fpa-snapshots/fpa-snapshot-<season>-<scoring>.json` (the canonical
snapshot, one per scoring, all four positions) plus the frontend
`fpa-<season>-<pos>-<scoring>.json` FPA-table files.

Scoring: interceptions are **−1**; receptions are 1.0 / 0.5 / 0.0 (PPR /
Half-PPR / Standard).

## Stage 2 — `build-sos.ts` (schedule → aFPA mapping)

Consumes the snapshot and **never recomputes aFPA**. For each team/week it
finds the scheduled opponent and looks up that opponent defense's
**position-specific** `adj` / `rank` / `bucket`:

- QB SOS uses opponent defense vs QB, RB vs RB, WR vs WR, TE vs TE.
- Player SOS maps each player to their current team (2026 roster, falling back
  to their baseline team) and uses their team's schedule + their position's aFPA.

Each weekly cell attaches: `opponent`, `isHome`/`isAway`, `raw`, `adjustedPoints`
(`adj`), `rank`, `difficultyBucket`.

Summary columns (averages of opponent `adj`):

- `PO2` = weeks 16–17
- `PO3` = weeks 15–17
- `ROS` = remaining weeks through **Week 17** (Week 18 excluded from fantasy ROS)
- `OVR` (overall rank) uses the full NFL season (weeks 1–18)

## Output files (in `public/data/sos/`)

- `manifest.json`, `schedule-2026.json`
- `team-sos-2026-<pos>-<scoring>.json`, `player-sos-2026-<pos>-<scoring>.json`
- `fpa-2025-<pos>-<scoring>.json`, `insights-2026-<scoring>.json`

`<pos>` ∈ `qb rb wr te`; `<scoring>` ∈ `ppr half-ppr std`.

## Run locally

```bash
pnpm --filter @workspace/scripts run sos        # ingest + build
# or individually:
pnpm --filter @workspace/scripts run ingest:fpa
pnpm --filter @workspace/scripts run build:sos
```

Env overrides: `SOS_SEASON`, `SOS_BASELINE_SEASONS` (e.g. `2025,2026` once 2026
games exist), `SOS_OUTPUT_DIR` is not used — output goes to the app's public
dir; `SOS_SNAPSHOT_DIR` overrides the snapshot location.

Demo data (no network, fabricated — for frontend dev only):

```bash
node scripts/gen-demo-sos.mjs
```

## Automation

`.github/workflows/update-sos.yml` reruns the pipeline and commits the JSON on a
cron (every 3 days) and on manual dispatch.

## WordPress embed

Upload `public/data/sos/*.json` to
`https://statchasers.com/wp-content/uploads/sc-data/sos/` and build the app with
the data base pointed there:

```bash
VITE_SOS_DATA_BASE=https://statchasers.com/wp-content/uploads/sc-data/sos \
  pnpm --filter @workspace/statchasers-sos run build
```
