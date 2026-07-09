import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import { useFilters, type FilterState } from "@/hooks/use-filters";
import { getRuntimeConfig, type SosRuntimeConfig } from "@/lib/runtime-config";
import {
  parseSosUrl,
  buildSosUrl,
  type SosTab,
  type SosPosition,
  type SosScoring,
} from "@/lib/sos-url";
import { SosFilters } from "@/components/sos/sos-filters";
import { InsightCards, type CardFocus } from "@/components/sos/insight-cards";
import { TeamMatrix } from "@/components/sos/team-matrix";
import { PlayerMatrix } from "@/components/sos/player-matrix";
import { DifficultyLegend } from "@/components/sos/difficulty-legend";
import { BaselineNotice } from "@/components/sos/baseline-notice";
import { fetchTeamSosCsv, fetchPlayerSosCsv } from "@/lib/sos-client";

const SCORING_LABELS: Record<string, string> = {
  PPR: "PPR",
  HALF_PPR: "Half-PPR",
  STANDARD: "Standard",
};
// Map between the filter enum values and the URL scoring slugs.
const SCORING_TO_SLUG: Record<string, SosScoring> = {
  PPR: "ppr",
  HALF_PPR: "half-ppr",
  STANDARD: "std",
};
const SLUG_TO_SCORING: Record<SosScoring, string> = {
  ppr: "PPR",
  "half-ppr": "HALF_PPR",
  std: "STANDARD",
};
const VALID_TABS: SosTab[] = ["team", "player"];
const VALID_POSITIONS: SosPosition[] = ["qb", "rb", "wr", "te"];
const VALID_SCORINGS: SosScoring[] = ["ppr", "half-ppr", "std"];

/**
 * Resolve the inline embed's view from the host page's `?tab&pos&scoring` query
 * string, falling back to the host-injected initial state and then hard
 * defaults. Every value is validated so a hand-edited URL can't blank the view.
 */
function readInlineState(cfg: SosRuntimeConfig): {
  tab: SosTab;
  position: SosPosition;
  scoring: SosScoring;
} {
  const p = new URLSearchParams(window.location.search);
  const init = cfg.initialState ?? {};
  const pick = <T extends string>(
    v: string | undefined | null,
    allowed: T[],
    dflt: T,
  ): T => (v != null && (allowed as string[]).includes(v) ? (v as T) : dflt);
  return {
    tab: pick(p.get("tab") ?? init.tab, VALID_TABS, "team"),
    position: pick((p.get("pos") ?? init.position)?.toLowerCase(), VALID_POSITIONS, "rb"),
    scoring: pick(p.get("scoring") ?? init.scoring, VALID_SCORINGS, "ppr"),
  };
}

export default function Home() {
  const { filters, setFilters } = useFilters();
  const [activeTab, setActiveTab] = useState("team");
  // Set when an insight card is clicked; tells the active matrix to sort,
  // highlight and scroll to the picked row. The nonce re-fires repeat clicks.
  const [focus, setFocus] = useState<CardFocus | null>(null);
  const handleCardSelect = (f: Omit<CardFocus, "nonce">) =>
    setFocus((prev) => ({ ...f, nonce: (prev?.nonce ?? 0) + 1 }));

  // --- URL / host state sync ----------------------------------------------
  // Standalone (preview/local dev): push a clean path like
  //   /nfl/strength-of-schedule/player/wr/half-ppr/
  // Inline embed (WordPress/Divi, Shadow DOM): reflect the view in the host
  //   page's own `?tab&pos&scoring` query string so it stays shareable, without
  //   rewriting the page's path (which the host may not route).
  const syncState = (tab: string, f: FilterState) => {
    if (typeof window === "undefined") return;
    const slugState = {
      tab: tab as SosTab,
      position: String(f.position).toLowerCase() as SosPosition,
      scoring: SCORING_TO_SLUG[f.scoring] ?? "ppr",
    };
    const cfg = getRuntimeConfig();

    if (cfg.inline) {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", slugState.tab);
      u.searchParams.set("pos", slugState.position);
      u.searchParams.set("scoring", slugState.scoring);
      if (u.href !== window.location.href) {
        window.history.pushState(null, "", u.href);
      }
      return;
    }

    // Hosts that can't route deep pretty-URLs set prettyUrls:false.
    if (cfg.prettyUrls === false) return;
    const next = buildSosUrl(slugState);
    const strip = (s: string) => s.replace(/\/+$/, "");
    if (strip(next) !== strip(window.location.pathname)) {
      window.history.pushState(slugState, "", next);
    }
  };

  // A pick belongs to the tab it was made on — drop it when switching tabs so
  // it doesn't re-sort the other table.
  const handleTabChange = (tab: string) => {
    setFocus(null);
    setActiveTab(tab);
    syncState(tab, filters);
  };
  const handleFiltersChange = (next: FilterState) => {
    setFilters(next);
    syncState(activeTab, next);
  };

  // Drive UI state from a slug triple (used by both URL parsing and the host).
  const applySlugState = (s: { tab: string; position: string; scoring: string }) => {
    setActiveTab(s.tab);
    setFilters((prev) => ({
      ...prev,
      position: s.position.toUpperCase() as FilterState["position"],
      scoring: (SLUG_TO_SCORING[s.scoring as SosScoring] ?? "PPR") as FilterState["scoring"],
    }));
    setFocus(null);
  };

  // On load + on browser back/forward, drive state from the right source.
  useEffect(() => {
    const cfg = getRuntimeConfig();

    if (cfg.inline) {
      // Inline embed: the view lives in the host page's `?tab&pos&scoring`
      // query string, seeded on first load from the injected initial state.
      const apply = () => applySlugState(readInlineState(cfg));
      apply();
      window.addEventListener("popstate", apply);
      return () => window.removeEventListener("popstate", apply);
    }

    const apply = () => applySlugState(parseSosUrl(window.location.pathname));
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Inline embeds live inside a host page that owns its own <title>/<meta> —
    // leave the host document's head untouched.
    if (getRuntimeConfig().inline) return;

    document.title = "Fantasy Football Strength of Schedule | 2026 SOS by Team & Player";

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'View 2026 fantasy football strength of schedule by team, player, position, scoring format, rest-of-season, and fantasy playoff weeks.');
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  };

  const handleExportTeam = async () => {
    try {
      // CSV is built client-side from the static SOS JSON.
      const blob = await fetchTeamSosCsv({
        season: filters.season,
        position: filters.position as any,
        scoring: filters.scoring as any,
        metric: filters.metric as any,
      });
      downloadBlob(blob, `statchasers_team_sos_${filters.season}_${filters.position}.csv`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPlayer = async () => {
    try {
      const blob = await fetchPlayerSosCsv({
        season: filters.season,
        position: filters.position as any,
        scoring: filters.scoring as any,
        metric: filters.metric as any,
      });
      downloadBlob(blob, `statchasers_player_sos_${filters.season}_${filters.position}.csv`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-background text-foreground flex flex-col">
      <SosFilters
        filters={filters}
        setFilters={handleFiltersChange}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onExport={activeTab === "player" ? handleExportPlayer : handleExportTeam}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto min-w-0 px-[5px] pt-[17px] pb-[42px]">
        <InsightCards filters={filters} activeTab={activeTab} onSelect={handleCardSelect} />

        {/* Flat, inline "how to read" context — no card/box. Heading + key on
            one row with the aFPA link pushed to the far right; the active
            season/position/scoring/weeks as small muted metadata (not pills,
            since the filters above already own those as controls). */}
        <div className="mb-3" data-testid="text-view-description">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <p className="flex items-start gap-2 text-sm leading-snug">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="font-bold text-foreground">How to read this board</span>
                <span className="text-muted-foreground">
                  {" — "}Higher aFPA = easier matchup · <span className="font-bold text-foreground">vs</span> = home ·{" "}
                  <span className="font-bold text-foreground">@</span> = away
                </span>
              </span>
            </p>
            <div className="flex flex-col items-start gap-2 pl-6 sm:items-end sm:pl-0">
              <a
                href="https://statchasers.com/nfl/fantasy-points-allowed/"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 whitespace-nowrap text-xs font-bold text-[#17457a] hover:underline decoration-primary decoration-2 underline-offset-2"
              >
                How aFPA works →
              </a>
              <BaselineNotice />
            </div>
          </div>
          <p className="mt-1 pl-6 text-xs font-medium text-muted-foreground">
            {[
              String(filters.season),
              filters.position,
              SCORING_LABELS[filters.scoring] ?? filters.scoring,
              "Weeks 1–17",
            ].join(" · ")}
          </p>
        </div>

        {/* One light divider is all the separation the context vs. legend/actions
            needs — no surrounding box. */}
        <hr className="mb-3 border-t border-[rgba(11,31,58,0.08)]" />

        {/* Flat legend row — the color key. (Export now lives in the header next
            to the view tabs; baseline lives in the context block above.) */}
        <div className="mb-4">
          <DifficultyLegend bare />
        </div>

        {/* Scroll region so a wide table scrolls within the tool instead of pushing the page wider on the right.
            pb-4 reserves space for the horizontal scrollbar so the last rows aren't clipped in the iframe embed. */}
        <div className="w-full overflow-x-auto pb-4">
          {activeTab === "team" && <TeamMatrix filters={filters} focus={focus} />}
          {activeTab === "player" && <PlayerMatrix filters={filters} focus={focus} />}
        </div>
      </main>
    </div>
  );
}
