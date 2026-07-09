/**
 * Pretty-URL routing for the SOS tool, embedded at:
 *   /nfl/strength-of-schedule/
 *
 * Supported shapes (trailing slash optional):
 *   /nfl/strength-of-schedule/                  -> default (team / rb / ppr)
 *   /nfl/strength-of-schedule/team/qb/ppr/
 *   /nfl/strength-of-schedule/player/wr/half-ppr/
 *   /nfl/strength-of-schedule/team/rb/std/
 *
 * Parsing is base-path agnostic: it locates the "strength-of-schedule" segment
 * in the path, so the same code works whether the app is mounted at the WP page,
 * a subpath, or "/" in local dev.
 *
 * The tool only has Team and Player tabs and QB/RB/WR/TE positions (there are
 * no FPA or Schedule tabs). Any unsupported segment falls back to the defaults
 * so a stray/legacy URL never produces a blank view.
 */

export type SosTab = "team" | "player";
export type SosPosition = "qb" | "rb" | "wr" | "te";
export type SosScoring = "ppr" | "half-ppr" | "std";

export interface SosUrlState {
  tab: SosTab;
  position: SosPosition;
  scoring: SosScoring;
}

export const DEFAULT_SOS_STATE: SosUrlState = {
  tab: "team",
  position: "rb",
  scoring: "ppr",
};

const SOS_SEGMENT = "strength-of-schedule";
const VALID_TABS: SosTab[] = ["team", "player"];
const VALID_POSITIONS: SosPosition[] = ["qb", "rb", "wr", "te"];
const VALID_SCORING: SosScoring[] = ["ppr", "half-ppr", "std"];

const includes = <T extends string>(arr: T[], v: string | undefined): v is T =>
  v != null && (arr as string[]).includes(v);

const segments = (pathname: string) =>
  pathname.replace(/\/+$/, "").split("/").filter(Boolean);

/** Parse the current path into tab/position/scoring, with safe fallbacks. */
export function parseSosUrl(pathname: string): SosUrlState {
  const parts = segments(pathname);
  const i = parts.indexOf(SOS_SEGMENT);
  if (i === -1) return { ...DEFAULT_SOS_STATE };

  const tab = parts[i + 1];
  const position = parts[i + 2];
  const scoring = parts[i + 3];

  return {
    tab: includes(VALID_TABS, tab) ? tab : DEFAULT_SOS_STATE.tab,
    position: includes(VALID_POSITIONS, position) ? position : DEFAULT_SOS_STATE.position,
    scoring: includes(VALID_SCORING, scoring) ? scoring : DEFAULT_SOS_STATE.scoring,
  };
}

/** Everything up to and including the "strength-of-schedule" segment. */
function basePrefix(pathname: string): string {
  const parts = segments(pathname);
  const i = parts.indexOf(SOS_SEGMENT);
  if (i >= 0) return "/" + parts.slice(0, i + 1).join("/");
  return "/nfl/" + SOS_SEGMENT;
}

/** Build the canonical pretty path for a given state. */
export function buildSosUrl(
  state: SosUrlState,
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "/",
): string {
  return `${basePrefix(pathname)}/${state.tab}/${state.position}/${state.scoring}/`;
}
