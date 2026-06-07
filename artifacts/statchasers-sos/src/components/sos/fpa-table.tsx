import { FilterState } from "@/hooks/use-filters";
import { useGetFantasyPointsAllowed, getGetFantasyPointsAllowedQueryKey } from "@workspace/api-client-react";
import { cn, getDifficultyColorClass } from "@/lib/utils";

interface FpaTableProps {
  filters: FilterState;
}

export function FpaTable({ filters }: FpaTableProps) {
  const { data, isLoading } = useGetFantasyPointsAllowed(
    { season: filters.season, position: filters.position, scoring: filters.scoring },
    { query: { enabled: !!filters.season, queryKey: getGetFantasyPointsAllowedQueryKey({ season: filters.season, position: filters.position, scoring: filters.scoring }) } }
  );

  if (isLoading) {
    return <div className="h-96 w-full flex items-center justify-center bg-card rounded-lg border border-border animate-pulse"><span className="text-muted-foreground font-mono">LOADING FPA DATA...</span></div>;
  }

  if (!data?.rows || data.rows.length === 0) {
     return <div className="h-40 flex items-center justify-center border border-border rounded-lg bg-card text-muted-foreground font-mono">NO FPA DATA FOUND</div>;
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card pb-4">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-xs uppercase bg-muted/50 text-muted-foreground sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 bg-muted px-4 py-3 font-semibold border-b border-r border-border z-30 min-w-[120px]">Defense</th>
            <th className="px-4 py-3 font-semibold border-b border-r border-border min-w-[80px] text-center">Rank</th>
            <th className="px-4 py-3 font-semibold border-b border-r border-border min-w-[120px] text-center">Raw Pts</th>
            <th className="px-4 py-3 font-semibold border-b border-r border-border min-w-[120px] text-center">Adj Pts</th>
            <th className="px-4 py-3 font-semibold border-b border-border min-w-[100px] text-center">Difficulty</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {data.rows.map((row, i) => (
            <tr key={row.defenseTeam} data-testid={`fpa-row-${row.defenseTeam}`} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-muted/10")}>
              <td className="sticky left-0 bg-card px-4 py-2 border-r border-border font-semibold flex items-center gap-2 z-10">
                <span className="text-foreground">{row.defenseTeam}</span>
              </td>
              <td className="px-4 py-2 border-r border-border text-center font-bold">{row.rank}</td>
              <td className="px-4 py-2 border-r border-border text-center text-muted-foreground">{row.rawPointsAllowed.toFixed(1)}</td>
              <td className="px-4 py-2 border-r border-border text-center font-bold text-primary">{row.adjustedPointsAllowed.toFixed(1)}</td>
              <td className="px-1 py-1 text-center text-xs font-semibold p-0.5">
                <div className={cn("w-full h-full flex items-center justify-center py-2 rounded-sm", getDifficultyColorClass(row.difficultyBucket))}>
                  {row.difficultyBucket}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
