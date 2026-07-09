import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { FilterState } from "@/hooks/use-filters";
import { useGetTeamSos, getGetTeamSosQueryKey } from "@/lib/sos-client";
import { cn, getDifficultyColorClass, getTeamLogoUrl, bucketFromScheduleRank } from "@/lib/utils";
import { WeekCell } from "@workspace/api-client-react";
import { SortHeader, useSort, type Accessor } from "./sortable";
import { useCardFocus } from "./use-card-focus";
import type { CardFocus } from "./insight-cards";

interface TeamMatrixProps {
  filters: FilterState;
  focus?: CardFocus | null;
}

type TeamRow = {
  team: string;
  overallRank: number;
  rosRank: number;
  playoffRank: number;
  rosSummary?: number | null;
  weeks: (WeekCell | undefined)[];
  playoff2?: WeekCell | null;
  playoff3?: WeekCell | null;
};

const TEAM_ACCESSORS: Record<string, Accessor<TeamRow>> = {
  team: (r) => r.team,
  ovr: (r) => r.overallRank,
  ros: (r) => r.rosRank,
  playoff: (r) => r.playoffRank,
  po2: (r) => r.playoff2?.rank,
  po3: (r) => r.playoff3?.rank,
  rosSummary: (r) => r.rosSummary,
  // Week columns sort by opponent-defense rank (BYE weeks fall to the bottom).
  // Weeks 1-17 only — Week 18 is not a fantasy week.
  ...Object.fromEntries(
    Array.from({ length: 17 }, (_, i) => [`w${i + 1}`, (r: TeamRow) => r.weeks[i]?.rank] as const),
  ),
};

export function TeamMatrix({ filters, focus }: TeamMatrixProps) {
  const { data, isLoading } = useGetTeamSos(
    filters,
    { query: { enabled: !!filters.season, queryKey: getGetTeamSosQueryKey(filters) } }
  );
  const { sorted, sort, toggle, setSortDirect } = useSort(data?.rows as TeamRow[] | undefined, TEAM_ACCESSORS);
  const highlightId = useCardFocus(focus, setSortDirect);

  // Responsive column compression. Rather than staying wide until the columns
  // hit their vw-clamp floor and then jumping to a horizontal scrollbar, watch
  // the table against its container and progressively shrink padding + every
  // column's width (down to 80%) the moment the full table can no longer fit on
  // one screen. Mirrors PlayerMatrix's padScale logic.
  const tableRef = useRef<HTMLTableElement>(null);
  const [padScale, setPadScale] = useState(1);

  const MIN_PAD_SCALE = 0.8; // compress columns by at most 20%
  const PAD_STEP = 0.05;
  const PAD_BUFFER = 80; // start compressing this many px before the table would overflow
  // Dead band before growing back, wider than one step so it can't oscillate.
  const PAD_HYST = 100;

  useLayoutEffect(() => {
    const table = tableRef.current;
    const parent = table?.parentElement;
    if (!table || !parent) return;

    const measure = () => {
      const available = parent.clientWidth;
      const width = table.scrollWidth;
      if (width > available - PAD_BUFFER && padScale > MIN_PAD_SCALE) {
        // Approaching the limit: compress columns pre-emptively.
        setPadScale((s) => Math.max(MIN_PAD_SCALE, Number((s - PAD_STEP).toFixed(2))));
      } else if (padScale < 1 && available >= width + PAD_BUFFER + PAD_HYST) {
        // Room to spare: ease columns back out, keeping a dead band.
        setPadScale((s) => Math.min(1, Number((s + PAD_STEP).toFixed(2))));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [padScale, sorted]);

  if (isLoading) {
    return <div className="h-96 w-full flex items-center justify-center bg-card rounded-lg border border-border animate-pulse"><span className="text-muted-foreground font-mono">LOADING TEAM DATA...</span></div>;
  }

  if (!data?.rows) return null;

  // Each cell shows the opponent matchup with the aFPA (adjusted fantasy
  // points allowed) underneath. Playoff summary cells have no opponent, so
  // they render the aFPA average alone.
  const renderCellContent = (cell: WeekCell) => {
    if (cell.isBye) return "BYE";
    const afpa = cell.adjustedPoints?.toFixed(1) ?? "-";
    if (!cell.opponent) return afpa;
    return (
      <div className="flex flex-col items-center leading-tight">
        <span>{cell.isHome ? "" : "@"}{cell.opponent}</span>
        <span className="text-[10px] font-normal opacity-80">{afpa}</span>
      </div>
    );
  };

  // Weeks 1-17 — Week 18 is excluded from fantasy SOS.
  const weeks = Array.from({ length: 17 }, (_, i) => i + 1);

  return (
      <table
        ref={tableRef}
        style={
          {
            "--pad-x": `${(3 * padScale).toFixed(2)}px`,
            // Unitless multiplier used to scale every column's width via calc().
            "--pad-scale": padScale,
          } as CSSProperties
        }
        className="w-full text-sm text-left border-collapse border border-border"
      >
        <thead className="text-xs uppercase bg-foreground text-background">
          <tr>
            <SortHeader label="Team" sortKey="team" sort={sort} onSort={toggle} align="center" tooltip="NFL team. Each weekly cell shows the opponent's defense difficulty vs this position." className="sticky left-0 bg-foreground px-[var(--pad-x)] py-3 border-b border-r border-border z-30 min-w-[calc(clamp(64px,5.7vw,72px)*var(--pad-scale))] whitespace-nowrap" />
            <SortHeader label="OVR" sortKey="ovr" sort={sort} onSort={toggle} tooltip="Overall schedule rank, Weeks 1-17. 1 = easiest schedule, 32 = hardest, by average opponent adjusted points allowed vs this position." className="px-[var(--pad-x)] py-3 border-b border-r border-border w-[calc(clamp(43px,4.2vw,50px)*var(--pad-scale))]" />
            <SortHeader label="ROS" sortKey="ros" sort={sort} onSort={toggle} tooltip="Rest-of-season schedule rank — remaining games through Week 17. 1 = easiest remaining schedule." className="px-[var(--pad-x)] py-3 border-b border-r border-border w-[calc(clamp(43px,4.2vw,50px)*var(--pad-scale))]" />
            <SortHeader label={<>Play<br />Off</>} sortKey="playoff" sort={sort} onSort={toggle} tooltip="Fantasy playoff schedule rank, Weeks 15-17. 1 = easiest playoff slate." className="px-[var(--pad-x)] py-3 border-b border-r border-border w-[calc(clamp(55px,5.4vw,65px)*var(--pad-scale))]" />
            {weeks.map(w => (
              <SortHeader key={w} label={`W${w}`} sortKey={`w${w}`} sort={sort} onSort={toggle} tooltip={`Week ${w} matchup. Color shows how tough the opponent's defense is vs this position (their adjusted-points-allowed rank).`} className="px-[3px] py-3 border-b border-r border-border min-w-[calc(clamp(46px,4.5vw,54px)*var(--pad-scale))]" />
            ))}
            <SortHeader label="PO2" sortKey="po2" sort={sort} onSort={toggle} tooltip="Playoff Weeks 16-17: average opponent difficulty (adjusted points allowed)." className="px-[3px] py-3 border-b border-r border-border min-w-[calc(clamp(46px,4.5vw,54px)*var(--pad-scale))]" />
            <SortHeader label="PO3" sortKey="po3" sort={sort} onSort={toggle} tooltip="Playoff Weeks 15-17: average opponent difficulty (adjusted points allowed)." className="px-[3px] py-3 border-b border-r border-border min-w-[calc(clamp(46px,4.5vw,54px)*var(--pad-scale))]" />
            <SortHeader label="ROS" sortKey="rosSummary" sort={sort} onSort={toggle} defaultDir="desc" tooltip="Average opponent adjusted fantasy points allowed over remaining weeks (through Week 17). Higher = easier." className="px-[3px] py-3 border-b border-border min-w-[calc(clamp(46px,4.5vw,54px)*var(--pad-scale))]" />
          </tr>
        </thead>
        <tbody className="font-mono">
          {(sorted ?? []).map((row, i) => (
            <tr key={row.team} data-testid={`team-row-${row.team}`} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-muted/10", highlightId === `team-row-${row.team}` && "ring-2 ring-inset ring-amber-400 bg-amber-400/10")}>
              <td className="sticky left-0 bg-card px-[var(--pad-x)] py-1 border-r border-border font-semibold z-10 whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <img
                    src={getTeamLogoUrl(row.team) ?? undefined}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-5 w-5 shrink-0 object-contain"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  <span className="text-[10.1px] text-foreground">{row.team}</span>
                </div>
              </td>
              <td className="px-[var(--pad-x)] py-1 border-r border-border text-center text-[11.2px] font-bold">{row.overallRank}</td>
              <td className="px-[var(--pad-x)] py-1 border-r border-border text-center text-[11.2px] font-bold text-muted-foreground">{row.rosRank}</td>
              <td className="px-[var(--pad-x)] py-1 border-r border-border text-center text-[11.2px] font-bold">{row.playoffRank}</td>
              
              {weeks.map((w, index) => {
                const cell = row.weeks[index];
                return (
                  <td key={w} className={cn("px-1 py-1 border-r border-border/50 text-center text-xs font-semibold p-0.5", cell?.isBye ? "bg-card" : "")}>
                     {cell && (
                        <div className={cn("w-full h-full flex items-center justify-center py-1 rounded-sm", getDifficultyColorClass(cell.difficultyBucket, cell.isBye))}>
                          {renderCellContent(cell)}
                        </div>
                     )}
                  </td>
                )
              })}
              
              <td className="px-1 py-1 border-r border-border/50 text-center text-xs font-semibold p-0.5">
                {row.playoff2 && (
                  <div className={cn("w-full h-full flex items-center justify-center py-1 rounded-sm", getDifficultyColorClass(row.playoff2.difficultyBucket, row.playoff2.isBye))}>
                    {renderCellContent(row.playoff2)}
                  </div>
                )}
              </td>
              <td className="px-1 py-1 border-r border-border/50 text-center text-xs font-semibold p-0.5">
                {row.playoff3 && (
                  <div className={cn("w-full h-full flex items-center justify-center py-1 rounded-sm", getDifficultyColorClass(row.playoff3.difficultyBucket, row.playoff3.isBye))}>
                    {renderCellContent(row.playoff3)}
                  </div>
                )}
              </td>
              <td className="px-1 py-1 text-center text-xs font-semibold p-0.5">
                {row.rosSummary != null ? (
                  <div className={cn("w-full h-full flex items-center justify-center py-1 rounded-sm", getDifficultyColorClass(bucketFromScheduleRank(row.rosRank)))}>
                    {row.rosSummary.toFixed(1)}
                  </div>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
  );
}
