import { useLayoutEffect, useRef, useState } from "react";
import { FilterState } from "@/hooks/use-filters";
import { useGetPlayerSos, getGetPlayerSosQueryKey } from "@/lib/sos-client";
import { cn, getDifficultyColorClass } from "@/lib/utils";
import { WeekCell } from "@workspace/api-client-react";
import { SortHeader, useSort, type Accessor } from "./sortable";
import { useCardFocus } from "./use-card-focus";
import type { CardFocus } from "./insight-cards";

interface PlayerMatrixProps {
  filters: FilterState;
  focus?: CardFocus | null;
}

/**
 * "DeVonta Smith" -> "D. Smith" (first initial + last name). Hyphenated last
 * names collapse to all-initials so they don't blow out the column —
 * "Jacory Croskey-Merritt" -> "JCM".
 */
function abbreviateName(name: string): string {
  const sp = name.indexOf(" ");
  if (sp <= 0) return name;
  const last = name.slice(sp + 1);
  if (last.includes("-")) {
    return (name[0] + last.replace(/[^A-Za-z-]/g, "").split("-").map(p => p[0] ?? "").join("")).toUpperCase();
  }
  return `${name[0]}. ${last}`;
}

type PlayerRow = {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  sosRank: number;
  rosSosRank: number;
  playoffSosRank: number;
  weeks: (WeekCell | undefined)[];
  playoff2?: WeekCell | null;
  playoff3?: WeekCell | null;
};

const PLAYER_ACCESSORS: Record<string, Accessor<PlayerRow>> = {
  player: (r) => r.playerName,
  team: (r) => r.team,
  ovr: (r) => r.sosRank,
  ros: (r) => r.rosSosRank,
  playoff: (r) => r.playoffSosRank,
  po2: (r) => r.playoff2?.rank,
  po3: (r) => r.playoff3?.rank,
  // Week columns sort by opponent-defense rank (BYE weeks fall to the bottom).
  // Weeks 1-17 only — Week 18 is not a fantasy week.
  ...Object.fromEntries(
    Array.from({ length: 17 }, (_, i) => [`w${i + 1}`, (r: PlayerRow) => r.weeks[i]?.rank] as const),
  ),
};

export function PlayerMatrix({ filters, focus }: PlayerMatrixProps) {
  const { data, isLoading } = useGetPlayerSos(
    filters,
    { query: { enabled: !!filters.season, queryKey: getGetPlayerSosQueryKey(filters) } }
  );
  const { sorted, sort, toggle, setSortDirect } = useSort(data?.rows as PlayerRow[] | undefined, PLAYER_ACCESSORS);
  const highlightId = useCardFocus(focus, setSortDirect);

  // Show full player names while the table fits on screen; collapse to
  // "F. Last" the moment it would need horizontal scrolling. We compare the
  // table's intrinsic width against the space available and, once collapsed,
  // only expand again when the full-name width (captured below) fits — that
  // dead band keeps it from oscillating at the boundary.
  const tableRef = useRef<HTMLTableElement>(null);
  const fullWidthRef = useRef(0);
  const [compactNames, setCompactNames] = useState(false);

  useLayoutEffect(() => {
    const table = tableRef.current;
    const parent = table?.parentElement;
    if (!table || !parent) return;

    const measure = () => {
      const available = parent.clientWidth;
      if (!compactNames) {
        fullWidthRef.current = table.scrollWidth;
        if (table.scrollWidth > available) setCompactNames(true);
      } else if (fullWidthRef.current && available >= fullWidthRef.current) {
        setCompactNames(false);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [compactNames, sorted]);

  if (isLoading) {
    return <div className="h-96 w-full flex items-center justify-center bg-card rounded-lg border border-border animate-pulse"><span className="text-muted-foreground font-mono">LOADING PLAYER DATA...</span></div>;
  }

  if (!data?.rows || data.rows.length === 0) {
     return <div className="h-40 flex items-center justify-center border border-border rounded-lg bg-card text-muted-foreground font-mono">NO PLAYER DATA FOUND</div>;
  }

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
      <table ref={tableRef} className="w-full text-sm text-left border-collapse border border-border">
        <thead className="text-xs uppercase bg-foreground text-background">
          <tr>
            <SortHeader label="Player" sortKey="player" sort={sort} onSort={toggle} align="left" tooltip="Player, mapped to their current NFL team. Weekly cells use their team's opponent defense vs this position." className={cn("sticky left-0 bg-foreground px-[11px] py-3 border-b border-r border-border z-30", compactNames ? "min-w-[64px]" : "min-w-[clamp(84px,8.3vw,99px)] lg:min-w-[clamp(138px,13.5vw,162px)]")} />
            <SortHeader label="Team" sortKey="team" sort={sort} onSort={toggle} tooltip="Player's current NFL team." className="px-[11px] py-3 border-b border-r border-border min-w-[clamp(46px,4.5vw,54px)]" />
            <SortHeader label="OVR" sortKey="ovr" sort={sort} onSort={toggle} tooltip="Overall schedule rank, Weeks 1-17. 1 = easiest schedule, 32 = hardest, by average opponent adjusted points allowed vs this position." className="px-[11px] py-3 border-b border-r border-border min-w-[clamp(46px,4.5vw,54px)]" />
            <SortHeader label="ROS" sortKey="ros" sort={sort} onSort={toggle} tooltip="Rest-of-season schedule rank — remaining games through Week 17. 1 = easiest remaining schedule." className="px-[11px] py-3 border-b border-r border-border min-w-[clamp(46px,4.5vw,54px)]" />
            <SortHeader label={<>Play<br />Off</>} sortKey="playoff" sort={sort} onSort={toggle} tooltip="Fantasy playoff schedule rank, Weeks 15-17. 1 = easiest playoff slate." className="px-[11px] py-3 border-b border-r border-border min-w-[clamp(61px,6vw,72px)]" />
            {weeks.map(w => (
              <SortHeader key={w} label={`W${w}`} sortKey={`w${w}`} sort={sort} onSort={toggle} tooltip={`Week ${w} matchup. Color shows how tough the opponent's defense is vs this position (their adjusted-points-allowed rank).`} className="px-[3px] py-3 border-b border-r border-border min-w-[clamp(46px,4.5vw,54px)]" />
            ))}
            <SortHeader label="PO2" sortKey="po2" sort={sort} onSort={toggle} tooltip="Playoff Weeks 16-17: average opponent difficulty (adjusted points allowed)." className="px-[3px] py-3 border-b border-r border-border min-w-[clamp(46px,4.5vw,54px)]" />
            <SortHeader label="PO3" sortKey="po3" sort={sort} onSort={toggle} tooltip="Playoff Weeks 15-17: average opponent difficulty (adjusted points allowed)." className="px-[3px] py-3 border-b border-border min-w-[clamp(46px,4.5vw,54px)]" />
          </tr>
        </thead>
        <tbody className="font-mono">
          {(sorted ?? []).map((row, i) => (
            <tr key={row.playerId} data-testid={`player-row-${row.playerId}`} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-muted/10", highlightId === `player-row-${row.playerId}` && "ring-2 ring-inset ring-amber-400 bg-amber-400/10")}>
              <td className="sticky left-0 bg-card px-[11px] py-1 border-r border-border font-semibold z-10 max-w-[180px]">
                {/* Full name while the table fits; "F. Last" once it would need horizontal scroll. */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-foreground truncate">{compactNames ? abbreviateName(row.playerName) : row.playerName}</span>
                </div>
              </td>
              <td className="px-[11px] py-1 border-r border-border text-center text-muted-foreground">{row.team}</td>
              <td className="px-[11px] py-1 border-r border-border text-center font-bold">{row.sosRank}</td>
              <td className="px-[11px] py-1 border-r border-border text-center font-bold text-muted-foreground">{row.rosSosRank}</td>
              <td className="px-[11px] py-1 border-r border-border text-center font-bold text-primary">{row.playoffSosRank}</td>
              
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
              <td className="px-1 py-1 text-center text-xs font-semibold p-0.5">
                {row.playoff3 && (
                  <div className={cn("w-full h-full flex items-center justify-center py-1 rounded-sm", getDifficultyColorClass(row.playoff3.difficultyBucket, row.playoff3.isBye))}>
                    {renderCellContent(row.playoff3)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
  );
}
