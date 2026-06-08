# Strength-of-Schedule data pipeline

The SOS app (`artifacts/statchasers-sos`) reads **static JSON** — there is no
live API. The JSON is pre-built from nflverse data and hosted as flat files.

## How it fits together

```
nflverse (nflreadpy)
        │
        ▼
scripts/build_sos.py ──► artifacts/statchasers-sos/public/data/sos/*.json
        │                         │
   (GitHub Actions:               ▼
   update-sos.yml,           Vite serves them at /data/sos/...
   every 3 days)                  │
                                  ▼
              src/lib/sos-client.ts fetches per filter
              (e.g. team-sos-2026-rb-ppr.json)
```

## Model (v1)

- **Schedule:** 2026 NFL schedule → each team's weekly opponent.
- **Baseline:** 2025 weekly player stats → fantasy points allowed (FPA) by
  defense and position, for PPR / Half-PPR / Standard.
- **Adjustment:** each defense's allowed points are adjusted by how strong the
  offenses it faced were (subtracting offense strength minus league average),
  so defenses aren't penalized for facing elite offenses.
- **Ranks/buckets:** defenses ranked 1 (fewest adjusted points allowed =
  toughest) → 32; split into five buckets `VERY_TOUGH … SMASH_SPOT`.
- **Team/Player SOS:** map each team's 2026 schedule onto those defensive
  ranks. Schedule-difficulty ranks order teams **easiest → hardest** (rank 1 =
  most favorable schedule).
- Fantasy playoff cells: `playoff2` = weeks 16-17, `playoff3` = weeks 15-17.

Once the 2026 season starts, set `SOS_BASELINE_SEASONS=2025,2026` to blend in
live results (recent games dominate naturally as the sample grows).

## Output files (in `public/data/sos/`)

- `manifest.json`
- `schedule-2026.json`
- `team-sos-2026-<pos>-<scoring>.json`
- `player-sos-2026-<pos>-<scoring>.json`
- `fpa-2025-<pos>-<scoring>.json`
- `insights-2026-<scoring>.json`

`<pos>` ∈ `qb rb wr te`; `<scoring>` ∈ `ppr half-ppr std`.

## Run locally

Real data (needs Python + network):

```bash
pip install -r scripts/requirements.txt
python scripts/build_sos.py
```

Env overrides: `SOS_SEASON`, `SOS_BASELINE_SEASONS`, `SOS_OUTPUT_DIR`.

Demo data (no Python, fabricated — for frontend dev only):

```bash
node scripts/gen-demo-sos.mjs
```

## Automation

`.github/workflows/update-sos.yml` rebuilds and commits the JSON on a cron
(every 3 days) and on manual dispatch.

## WordPress embed

Upload `public/data/sos/*.json` to
`https://statchasers.com/wp-content/uploads/sc-data/sos/` and build the app
with the data base pointed there:

```bash
VITE_SOS_DATA_BASE=https://statchasers.com/wp-content/uploads/sc-data/sos \
  pnpm --filter @workspace/statchasers-sos run build
```

Then embed the built `dist/public` assets in the SOS page. The base path
defaults to `/data/sos` when the env var is unset.
