import { FilterState } from "@/hooks/use-filters";
import { useGetTeamSos, getGetTeamSosQueryKey } from "@/lib/sos-client";
import { cn, getDifficultyColorClass, getTeamLogoUrl } from "@/lib/utils";
import { GetTeamSosMetric, WeekCell, WeekCellDifficultyBucket } from "@workspace/api-client-react";
import { SortHeader, useSort, type Accessor } from "./sortable";

interface TeamMatrixProps {
  filters: FilterState;
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
  ...Object.fromEntries(
    Array.from({ length: 18 }, (_, i) => [`w${i + 1}`, (r: TeamRow) => r.weeks[i]?.rank] as const),
  ),
};

export function TeamMatrix({ filters }: TeamMatrixProps) {
  const { data, isLoading } = useGetTeamSos(
    filters,
    { query: { enabled: !!filters.season, queryKey: getGetTeamSosQueryKey(filters) } }
  );
  const { sorted, sort, toggle } = useSort(data?.rows as TeamRow[] | undefined, TEAM_ACCESSORS);

  if (isLoading) {
    return <div className="h-96 w-full flex items-center justify-center bg-card rounded-lg border border-border animate-pulse"><span className="text-muted-foreground font-mono">LOADING TEAM DATA...</span></div>;
  }

  if (!data?.rows) return null;

  const renderCellContent = (cell: WeekCell) => {
    if (cell.isBye) return "BYE";
    switch (filters.metric) {
      case GetTeamSosMetric.OPPONENT:
        return cell.opponent ? `${cell.isHome ? "vs." : "@"} ${cell.opponent}` : "-";
      case GetTeamSosMetric.RANK:
        return cell.rank ?? "-";
      case GetTeamSosMetric.ADJUSTED_POINTS:
        return cell.adjustedPoints?.toFixed(1) ?? "-";
      case GetTeamSosMetric.DIFFICULTY:
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
            <SortHeader label="Team" sortKey="team" sort={sort} onSort={toggle} align="left" className="sticky left-0 bg-foreground px-4 py-3 border-b border-r border-border z-30 min-w-[120px]" />
            <SortHeader label="OVR" sortKey="ovr" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[80px]" />
            <SortHeader label="ROS" sortKey="ros" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[80px]" />
            <SortHeader label="PLAYOFF" sortKey="playoff" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[80px]" />
            {weeks.map(w => (
              <SortHeader key={w} label={`W${w}`} sortKey={`w${w}`} sort={sort} onSort={toggle} className="px-2 py-3 border-b border-r border-border min-w-[60px]" />
            ))}
            <SortHeader label="PO2" sortKey="po2" sort={sort} onSort={toggle} className="px-2 py-3 border-b border-r border-border min-w-[60px]" />
            <SortHeader label="PO3" sortKey="po3" sort={sort} onSort={toggle} className="px-2 py-3 border-b border-r border-border min-w-[60px]" />
            <SortHeader label="ROS" sortKey="rosSummary" sort={sort} onSort={toggle} defaultDir="desc" className="px-2 py-3 border-b border-border min-w-[60px]" />
          </tr>
        </thead>
        <tbody className="font-mono">
          {(sorted ?? []).map((row, i) => (
            <tr key={row.team} data-testid={`team-row-${row.team}`} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-muted/10")}>
              <td className="sticky left-0 bg-card px-4 py-2 border-r border-border font-semibold flex items-center gap-2 z-10">
                <img
                  src={getTeamLogoUrl(row.team) ?? undefined}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="h-5 w-5 shrink-0 object-contain"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                />
                <span className="text-foreground">{row.team}</span>
              </td>
              <td className="px-4 py-2 border-r border-border text-center font-bold">{row.overallRank}</td>
              <td className="px-4 py-2 border-r border-border text-center font-bold text-muted-foreground">{row.rosRank}</td>
              <td className="px-4 py-2 border-r border-border text-center font-bold text-primary">{row.playoffRank}</td>
              
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
              <td className="px-1 py-1 border-r border-border/50 text-center text-xs font-semibold p-0.5">
                {row.playoff3 && (
                  <div className={cn("w-full h-full flex items-center justify-center py-2 rounded-sm", getDifficultyColorClass(row.playoff3.difficultyBucket, row.playoff3.isBye))}>
                    {renderCellContent(row.playoff3)}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-center text-muted-foreground">
                {row.rosSummary?.toFixed(1) || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
