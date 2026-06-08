import { FilterState } from "@/hooks/use-filters";
import { useGetSchedule, getGetScheduleQueryKey } from "@/lib/sos-client";
import { cn, getTeamLogoUrl } from "@/lib/utils";
import { ScheduleGame } from "@workspace/api-client-react";

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

  // Pivot the flat game list into a team x week matrix.
  const weeks = Array.from(new Set(data.games.map((g) => g.week))).sort((a, b) => a - b);
  const teams = Array.from(new Set(data.games.map((g) => g.team))).sort();
  const byTeamWeek = new Map<string, ScheduleGame>();
  for (const game of data.games) {
    byTeamWeek.set(`${game.team}-${game.week}`, game);
  }

  const matchupLabel = (game?: ScheduleGame) => {
    if (!game) return "-";
    if (game.isBye) return "BYE";
    return game.opponent ? `${game.isHome ? "vs." : "@"} ${game.opponent}` : "-";
  };

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card pb-4">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-xs uppercase bg-foreground text-background sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 bg-foreground px-4 py-3 font-semibold border-b border-r border-border z-30 min-w-[100px]">Team</th>
            {weeks.map((w) => (
              <th key={w} className="px-2 py-3 font-semibold border-b border-r border-border min-w-[80px] text-center">Week {w}</th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          {teams.map((team, i) => (
            <tr key={team} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "bg-transparent" : "bg-muted/10")}>
              <td className="sticky left-0 bg-card px-4 py-2 border-r border-border font-semibold text-foreground z-10">
                <span className="flex items-center gap-2">
                  <img
                    src={getTeamLogoUrl(team) ?? undefined}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-5 w-5 shrink-0 object-contain"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  {team}
                </span>
              </td>
              {weeks.map((w) => {
                const game = byTeamWeek.get(`${team}-${w}`);
                return (
                  <td key={w} className={cn("px-2 py-2 border-r border-border/50 text-center text-xs", game?.isBye ? "text-muted-foreground/60 italic" : "text-muted-foreground")}>
                    {matchupLabel(game)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
