import { FilterState } from "@/hooks/use-filters";
import { useGetFantasyPointsAllowed, getGetFantasyPointsAllowedQueryKey } from "@/lib/sos-client";
import { cn, getDifficultyColorClass } from "@/lib/utils";
import { SortHeader, useSort, type Accessor } from "./sortable";

interface FpaTableProps {
  filters: FilterState;
}

// Lower bucket index = tougher matchup, so difficulty sorts alongside rank.
const BUCKET_ORDER: Record<string, number> = {
  VERY_TOUGH: 0,
  TOUGH: 1,
  NEUTRAL: 2,
  FAVORABLE: 3,
  SMASH_SPOT: 4,
};

type FpaRow = { defenseTeam: string; rank: number; rawPointsAllowed: number; adjustedPointsAllowed: number; difficultyBucket: string };

const FPA_ACCESSORS: Record<string, Accessor<FpaRow>> = {
  defense: (r) => r.defenseTeam,
  rank: (r) => r.rank,
  raw: (r) => r.rawPointsAllowed,
  adj: (r) => r.adjustedPointsAllowed,
  difficulty: (r) => BUCKET_ORDER[r.difficultyBucket] ?? 99,
};

export function FpaTable({ filters }: FpaTableProps) {
  const fpaQueryParams = { season: 2025, position: filters.position, scoring: filters.scoring };
  const { data, isLoading } = useGetFantasyPointsAllowed(
    fpaQueryParams,
    { query: { enabled: !!filters.position, queryKey: getGetFantasyPointsAllowedQueryKey(fpaQueryParams) } }
  );
  const { sorted, sort, toggle } = useSort(data?.rows as FpaRow[] | undefined, FPA_ACCESSORS);

  if (isLoading) {
    return <div className="h-96 w-full flex items-center justify-center bg-card rounded-lg border border-border animate-pulse"><span className="text-muted-foreground font-mono">LOADING FPA DATA...</span></div>;
  }

  if (!data?.rows || data.rows.length === 0) {
     return <div className="h-40 flex items-center justify-center border border-border rounded-lg bg-card text-muted-foreground font-mono">NO FPA DATA FOUND</div>;
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card pb-4">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-xs uppercase bg-foreground text-background sticky top-0 z-20">
          <tr>
            <SortHeader label="Defense" sortKey="defense" sort={sort} onSort={toggle} align="left" className="sticky left-0 bg-foreground px-4 py-3 border-b border-r border-border z-30 min-w-[120px]" />
            <SortHeader label="Rank" sortKey="rank" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-r border-border min-w-[80px]" />
            <SortHeader label="Raw Pts" sortKey="raw" sort={sort} onSort={toggle} defaultDir="desc" className="px-4 py-3 border-b border-r border-border min-w-[120px]" />
            <SortHeader label="Adj Pts" sortKey="adj" sort={sort} onSort={toggle} defaultDir="desc" className="px-4 py-3 border-b border-r border-border min-w-[120px]" />
            <SortHeader label="Difficulty" sortKey="difficulty" sort={sort} onSort={toggle} className="px-4 py-3 border-b border-border min-w-[100px]" />
          </tr>
        </thead>
        <tbody className="font-mono">
          {(sorted ?? []).map((row, i) => (
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
