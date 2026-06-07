import { FilterState } from "@/hooks/use-filters";
import { useGetSchedule, getGetScheduleQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface ScheduleTableProps {
  filters: FilterState;
}

export function ScheduleTable({ filters }: ScheduleTableProps) {
  const { data, isLoading } = useGetSchedule(
    { season: filters.season },
    { query: { enabled: !!filters.season, queryKey: getGetScheduleQueryKey({ season: filters.season }) } }
  );

  if (isLoading) {
    return <div className="h-96 w-full flex items-center justify-center bg-card rounded-lg border border-border animate-pulse"><span className="text-muted-foreground font-mono">LOADING SCHEDULE...</span></div>;
  }

  if (!data?.games || data.games.length === 0) {
     return <div className="h-40 flex items-center justify-center border border-border rounded-lg bg-card text-muted-foreground font-mono">NO SCHEDULE FOUND</div>;
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card pb-4">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-xs uppercase bg-muted/50 text-muted-foreground sticky top-0 z-20">
          <tr>
            <th className="px-4 py-3 font-semibold border-b border-r border-border min-w-[80px] text-center">Week</th>
            <th className="px-4 py-3 font-semibold border-b border-r border-border min-w-[120px]">Team</th>
            <th className="px-4 py-3 font-semibold border-b border-border min-w-[120px]">Matchup</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {data.games.slice(0, 100).map((game, i) => (
            <tr key={`${game.team}-${game.week}`} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-muted/10")}>
              <td className="px-4 py-2 border-r border-border text-center font-bold">{game.week}</td>
              <td className="px-4 py-2 border-r border-border font-semibold">{game.team}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {game.isBye ? "BYE" : game.opponent ? `${game.isHome ? "vs." : "@"} ${game.opponent}` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.games.length > 100 && (
         <div className="p-4 text-center text-xs text-muted-foreground font-mono">SHOWING FIRST 100 GAMES</div>
      )}
    </div>
  );
}
