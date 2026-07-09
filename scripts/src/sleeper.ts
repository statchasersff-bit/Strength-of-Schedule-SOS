/**
 * sleeper.ts — pulls the live NFL depth chart and weekly projections from
 * Sleeper's public API, used to decide which players appear in Player SOS.
 *
 * Inclusion rule (see build-sos.ts): a player is listed if they are their
 * team's designated starter at the position (depth_chart_order === 1) OR they
 * are projected to score >= 8 fantasy points in any single game.
 *
 * Endpoints (public, unauthenticated):
 *   players:      https://api.sleeper.app/v1/players/nfl
 *   projections:  https://api.sleeper.com/projections/nfl/<season>/<week>?season_type=regular&position[]=...
 */
import { normTeam } from "./sos-lib.ts";

export interface SleeperPlayer {
  playerId: string;
  name: string;
  team: string | null;
  position: string | null;
  /** 1 = listed starter at their depth-chart slot. null when unranked. */
  depthOrder: number | null;
  status: string | null;
}

/** Max single-game projected points per scoring, keyed by Sleeper player id. */
export interface MaxProj {
  ppr: number;
  half: number;
  std: number;
}

async function fetchJson<T>(url: string, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

/** All NFL players, normalized to the fields we need. */
export async function loadSleeperPlayers(): Promise<Map<string, SleeperPlayer>> {
  type Raw = Record<string, {
    player_id?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    team?: string | null;
    position?: string | null;
    depth_chart_order?: number | null;
    status?: string | null;
  }>;
  const raw = await fetchJson<Raw>("https://api.sleeper.app/v1/players/nfl");
  const out = new Map<string, SleeperPlayer>();
  for (const [id, p] of Object.entries(raw)) {
    if (!p) continue;
    const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || id;
    out.set(id, {
      playerId: id,
      name,
      team: p.team ? normTeam(p.team) : null,
      position: p.position ?? null,
      depthOrder: p.depth_chart_order ?? null,
      status: p.status ?? null,
    });
  }
  return out;
}

/**
 * Max single-game projection per player across the given weeks, for each
 * scoring. One pass over the weekly endpoints (each entry carries all three
 * scoring totals), so all positions/scorings come from the same fetch set.
 */
export async function loadSleeperMaxProj(
  season: number,
  weeks: number[],
): Promise<Map<string, MaxProj>> {
  type Entry = {
    player_id?: string;
    stats?: { pts_ppr?: number | null; pts_half_ppr?: number | null; pts_std?: number | null };
  };
  const max = new Map<string, MaxProj>();
  const posParams = ["QB", "RB", "WR", "TE"].map((p) => `position[]=${p}`).join("&");
  for (const week of weeks) {
    const url = `https://api.sleeper.com/projections/nfl/${season}/${week}?season_type=regular&${posParams}`;
    let rows: Entry[];
    try {
      rows = await fetchJson<Entry[]>(url);
    } catch (err) {
      console.warn(`  (sleeper projections wk${week} unavailable: ${(err as Error).message})`);
      continue;
    }
    for (const e of rows) {
      const id = e.player_id;
      if (!id) continue;
      const s = e.stats ?? {};
      const cur = max.get(id) ?? { ppr: 0, half: 0, std: 0 };
      cur.ppr = Math.max(cur.ppr, s.pts_ppr ?? 0);
      cur.half = Math.max(cur.half, s.pts_half_ppr ?? 0);
      cur.std = Math.max(cur.std, s.pts_std ?? 0);
      max.set(id, cur);
    }
  }
  return max;
}

/** Sleeper-hosted headshot for a player id. UI falls back if it 404s. */
export const sleeperHeadshot = (playerId: string) =>
  `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
