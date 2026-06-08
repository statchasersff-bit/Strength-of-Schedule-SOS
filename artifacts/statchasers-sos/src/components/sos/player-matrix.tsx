import { FilterState } from "@/hooks/use-filters";
import { useGetPlayerSos, getGetPlayerSosQueryKey } from "@/lib/sos-client";
import { cn, getDifficultyColorClass } from "@/lib/utils";
import { GetPlayerSosMetric, WeekCell, WeekCellDifficultyBucket } from "@workspace/api-client-react";
import { SortHeader, useSort, type Accessor } from "./sortable";

interface PlayerMatrixProps {
  filters: FilterState;
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
  ...Object.fromEntries(
    Array.from({ length: 18 }, (_, i) => [`w${i + 1}`, (r: PlayerRow) => r.weeks[i]?.rank] as const),
  ),
};

export function PlayerMatrix({ filters }: PlayerMatrixProps) {
  const { data, isLoading } = useGetPlayerSos(
    filters,
    { query: { enabled: !!filters.season, queryKey: getGetPlayerSosQueryKey(filters) } }
  );
  const { sorted, sort, toggle } = useSort(data?.rows as PlayerRow[] | undefined, PLAYER_ACCESSORS);

  if (isLoading) {
    return <div className="h-96 w-full flex items-center justify-center bg-card rounded-lg border border-border animate-pulse"><span className="text-muted-foreground font-mono">LOADING PLAYER DATA...</span></div>;
  }

  if (!data?.rows || data.rows.length === 0) {
     return <div className="h-40 flex items-center justify-center border border-border rounded-lg bg-card text-muted-foreground font-mono">NO PLAYER DATA FOUND</div>;
  }

  const renderCellContent = (cell: WeekCell) => {
    if (cell.isBye) return "BYE";
    switch (filters.metric as unknown as GetPlayerSosMetric) {
      case GetPlayerSosMetric.OPPONENT:
        return cell.opponent ? `${cell.isHome ? "vs." : "@"} ${cell.opponent}` : "-";
      case GetPlayerSosMetric.RANK:
        return cell.rank ?? "-";
      case GetPlayerSosMetric.ADJUSTED_POINTS:
        return cell.adjustedPoints?.toFixed(1) ?? "-";
      case GetPlayerSosMetric.DIFFICULTY:
        switch(cell.difficultyBucket) {
          case WeekCellDifficultyBucket.SMASH_SPOT: return "SMASH";
          case WeekCellDifficultyBucket.FAVORABLE: return "FAV";
          case WeekCellDifficultyBucket.NEUTRAL: return "NEUT";
          case WeekCellDifficultyBucket.TOUGH: return "TOUGH";
          case WeekCellDifficultyBucket.VERY_TOUGH: return "V. TOUGH";
          default: return "-";
        }
      default:
        return cell.rank ?? "-";
    }
  };

  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card pb-4">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-xs uppercase bg-foreground text-background sticky top-0 z-20">
          <tr>
            <SortHeader label="Player" sortKey="player" sort={sort} onSort={toggle} align="left" className="sticky left-0 bg-foreground px-4 py-3 border-b border-r border-border z-30 min-w-[180px]" />
            <SortHeader label="Team" sortKey="team" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[60px]" />
            <SortHeader label="OVR" sortKey="ovr" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[60px]" />
            <SortHeader label="ROS" sortKey="ros" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[60px]" />
            <SortHeader label="PLAYOFF" sortKey="playoff" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[80px]" />
            {weeks.map(w => (
              <SortHeader key={w} label={`W${w}`} sortKey={`w${w}`} sort={sort} onSort={toggle} className="px-2 py-3 border-b border-r border-border min-w-[60px]" />
            ))}
            <SortHeader label="PO2" sortKey="po2" sort={sort} onSort={toggle} className="px-2 py-3 border-b border-r border-border min-w-[60px]" />
            <SortHeader label="PO3" sortKey="po3" sort={sort} onSort={toggle} className="px-2 py-3 border-b border-border min-w-[60px]" />
          </tr>
        </thead>
        <tbody className="font-mono">
          {(sorted ?? []).map((row, i) => (
            <tr key={row.playerId} data-testid={`player-row-${row.playerId}`} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-muted/10")}>
              <td className="sticky left-0 bg-card px-4 py-2 border-r border-border font-semibold flex items-center gap-2 z-10 truncate max-w-[200px]">
                <span className="text-foreground truncate">{row.playerName}</span>
                <span className="text-xs text-muted-foreground ml-auto">{row.position}</span>
              </td>
              <td className="px-4 py-2 border-r border-border text-center text-muted-foreground">{row.team}</td>
              <td className="px-4 py-2 border-r border-border text-center font-bold">{row.sosRank}</td>
              <td className="px-4 py-2 border-r border-border text-center font-bold text-muted-foreground">{row.rosSosRank}</td>
              <td className="px-4 py-2 border-r border-border text-center font-bold text-primary">{row.playoffSosRank}</td>
              
              {weeks.map((w, index) => {
                const cell = row.weeks[index];
                return (
                  <td key={w} className={cn("px-1 py-1 border-r border-border/50 text-center text-xs font-semibold p-0.5", cell?.isBye ? "bg-card" : "")}>
                     {cell && (
                        <div className={cn("w-full h-full flex items-center justify-center py-2 rounded-sm", getDifficultyColorClass(cell.difficultyBucket, cell.isBye))}>
                          {renderCellContent(cell)}
                        </div>
                     )}
                  </td>
                )
              })}
              
              <td className="px-1 py-1 border-r border-border/50 text-center text-xs font-semibold p-0.5">
                {row.playoff2 && (
                  <div className={cn("w-full h-full flex items-center justify-center py-2 rounded-sm", getDifficultyColorClass(row.playoff2.difficultyBucket, row.playoff2.isBye))}>
                    {renderCellContent(row.playoff2)}
                  </div>
                )}
              </td>
              <td className="px-1 py-1 text-center text-xs font-semibold p-0.5">
                {row.playoff3 && (
                  <div className={cn("w-full h-full flex items-center justify-center py-2 rounded-sm", getDifficultyColorClass(row.playoff3.difficultyBucket, row.playoff3.isBye))}>
                    {renderCellContent(row.playoff3)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
