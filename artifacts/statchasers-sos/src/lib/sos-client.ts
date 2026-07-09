/**
 * Static-JSON data layer for the SOS app.
 *
 * The app was generated against an orval REST client
 * (`@workspace/api-client-react`). In production the data is pre-built by
 * `scripts/build_sos.py` into static JSON files (one per position/scoring)
 * and hosted as flat files — there is no live API.
 *
 * This module re-exports every type / enum / helper from the generated
 * client, then overrides the data-fetching hooks so they read the static
 * JSON instead of hitting `/api/...`. Components only need to import from
 * here instead of `@workspace/api-client-react`.
 *
 * Set the data base path with the `VITE_SOS_DATA_BASE` env var (defaults to
 * `/data/sos`). For the WordPress embed, point it at the uploads dir, e.g.
 * `VITE_SOS_DATA_BASE=https://statchasers.com/wp-content/uploads/sc-data/sos`.
 */
import { useQuery } from "@tanstack/react-query";
import { getRuntimeConfig } from "./runtime-config";
import type {
  GetTeamSosParams,
  GetPlayerSosParams,
  GetFantasyPointsAllowedParams,
  GetScheduleParams,
  GetInsightsParams,
  ExportTeamSosCsvParams,
  ExportPlayerSosCsvParams,
  TeamSosResponse,
  PlayerSosResponse,
  FpaResponse,
  ScheduleResponse,
  InsightsResponse,
} from "@workspace/api-client-react";

// Re-export everything (types, enums, URL builders, setBaseUrl, ...). The
// explicit hook overrides below take precedence over the star re-exports.
export * from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// File resolution
// ---------------------------------------------------------------------------

const DATA_BASE: string = (
  getRuntimeConfig().dataBase ??
  (import.meta.env.VITE_SOS_DATA_BASE as string | undefined) ??
  "/data/sos"
).replace(/\/+$/, "");

const SCORING_SLUG: Record<string, string> = {
  PPR: "ppr",
  HALF_PPR: "half-ppr",
  STANDARD: "std",
};

function scoringSlug(scoring?: string): string {
  return SCORING_SLUG[scoring ?? "PPR"] ?? "ppr";
}

function posSlug(position?: string): string {
  return (position ?? "RB").toLowerCase();
}

function fileUrl(name: string): string {
  return `${DATA_BASE}/${name}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Failed to load ${url} (${res.status})`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const getGetTeamSosQueryKey = (params?: GetTeamSosParams) =>
  ["sos", "team", params?.season, params?.position, params?.scoring] as const;

export const getGetPlayerSosQueryKey = (params?: GetPlayerSosParams) =>
  ["sos", "player", params?.season, params?.position, params?.scoring] as const;

export const getGetFantasyPointsAllowedQueryKey = (
  params?: GetFantasyPointsAllowedParams,
) => ["sos", "fpa", params?.season, params?.position, params?.scoring] as const;

export const getGetScheduleQueryKey = (params?: GetScheduleParams) =>
  ["sos", "schedule", params?.season] as const;

export const getGetInsightsQueryKey = (params?: GetInsightsParams) =>
  ["sos", "insights", params?.season, params?.scoring] as const;

// ---------------------------------------------------------------------------
// Hooks (mirror the orval signature used by the components)
// ---------------------------------------------------------------------------

type HookOptions = { query?: { enabled?: boolean; queryKey?: readonly unknown[] } };

export function useGetTeamSos(params?: GetTeamSosParams, options?: HookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetTeamSosQueryKey(params),
    enabled: options?.query?.enabled,
    queryFn: () =>
      fetchJson<TeamSosResponse>(
        fileUrl(
          `team-sos-${params?.season}-${posSlug(params?.position)}-${scoringSlug(params?.scoring)}.json`,
        ),
      ),
  });
}

export function useGetPlayerSos(params?: GetPlayerSosParams, options?: HookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetPlayerSosQueryKey(params),
    enabled: options?.query?.enabled,
    queryFn: () =>
      fetchJson<PlayerSosResponse>(
        fileUrl(
          `player-sos-${params?.season}-${posSlug(params?.position)}-${scoringSlug(params?.scoring)}.json`,
        ),
      ),
  });
}

export function useGetFantasyPointsAllowed(
  params?: GetFantasyPointsAllowedParams,
  options?: HookOptions,
) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetFantasyPointsAllowedQueryKey(params),
    enabled: options?.query?.enabled,
    queryFn: () =>
      fetchJson<FpaResponse>(
        fileUrl(
          `fpa-${params?.season}-${posSlug(params?.position)}-${scoringSlug(params?.scoring)}.json`,
        ),
      ),
  });
}

export function useGetSchedule(params?: GetScheduleParams, options?: HookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetScheduleQueryKey(params),
    enabled: options?.query?.enabled,
    queryFn: () =>
      fetchJson<ScheduleResponse>(fileUrl(`schedule-${params?.season}.json`)),
  });
}

export function useGetInsights(params?: GetInsightsParams, options?: HookOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getGetInsightsQueryKey(params),
    enabled: options?.query?.enabled,
    queryFn: () =>
      fetchJson<InsightsResponse>(
        fileUrl(`insights-${params?.season}-${scoringSlug(params?.scoring)}.json`),
      ),
  });
}

// ---------------------------------------------------------------------------
// CSV export (built client-side from the static JSON)
// ---------------------------------------------------------------------------

const WEEK_HEADERS = Array.from({ length: 18 }, (_, i) => `W${i + 1}`);

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function weekLabel(cell?: {
  isBye: boolean;
  opponent?: string | null;
  isHome?: boolean | null;
  rank?: number | null;
}): string {
  if (!cell) return "";
  if (cell.isBye) return "BYE";
  const opp = cell.opponent ? `${cell.isHome ? "" : "@"}${cell.opponent}` : "-";
  return cell.rank != null ? `${opp} (${cell.rank})` : opp;
}

export async function fetchTeamSosCsv(params: ExportTeamSosCsvParams): Promise<Blob> {
  const data = await fetchJson<TeamSosResponse>(
    fileUrl(
      `team-sos-${params.season}-${posSlug(params.position)}-${scoringSlug(params.scoring)}.json`,
    ),
  );
  const header = [
    "Team",
    "OverallRank",
    "ROSRank",
    "PlayoffRank",
    "ROSSummary",
    ...WEEK_HEADERS,
  ];
  const rows = data.rows.map((row) => [
    row.team,
    row.overallRank,
    row.rosRank,
    row.playoffRank,
    row.rosSummary ?? "",
    ...row.weeks.map((c) => weekLabel(c)),
  ]);
  return new Blob([toCsv([header, ...rows])], { type: "text/csv" });
}

export async function fetchPlayerSosCsv(
  params: ExportPlayerSosCsvParams,
): Promise<Blob> {
  const data = await fetchJson<PlayerSosResponse>(
    fileUrl(
      `player-sos-${params.season}-${posSlug(params.position)}-${scoringSlug(params.scoring)}.json`,
    ),
  );
  const header = [
    "Player",
    "Team",
    "Position",
    "SOSRank",
    "ROSRank",
    "PlayoffRank",
    ...WEEK_HEADERS,
  ];
  const rows = data.rows.map((row) => [
    row.playerName,
    row.team,
    row.position,
    row.sosRank,
    row.rosSosRank,
    row.playoffSosRank,
    ...row.weeks.map((c) => weekLabel(c)),
  ]);
  return new Blob([toCsv([header, ...rows])], { type: "text/csv" });
}
