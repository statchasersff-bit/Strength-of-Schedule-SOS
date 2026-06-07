import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { FilterState } from "@/hooks/use-filters";
import { useGetInsights, getGetInsightsQueryKey } from "@workspace/api-client-react";

interface InsightCardsProps {
  filters: FilterState;
}

export function InsightCards({ filters }: InsightCardsProps) {
  const { data, isLoading } = useGetInsights(
    { season: filters.season, scoring: filters.scoring },
    { query: { enabled: !!filters.season, queryKey: getGetInsightsQueryKey({ season: filters.season, scoring: filters.scoring }) } }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-card rounded-lg border border-border animate-pulse border-l-4 border-l-primary/50" />
        ))}
      </div>
    );
  }

  if (!data?.cards) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {data.cards.map((card) => (
        <div key={card.id} data-testid={`card-insight-${card.id}`} className="bg-card rounded-lg border border-border overflow-hidden relative group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <div className="p-4 pl-5">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{card.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{card.subtitle}</p>
              </div>
              <div className={`p-1 rounded-full ${
                card.trend === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : 
                card.trend === 'negative' ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-500'
              }`}>
                {card.trend === 'positive' && <ArrowUp className="w-4 h-4" />}
                {card.trend === 'negative' && <ArrowDown className="w-4 h-4" />}
                {card.trend === 'neutral' && <Minus className="w-4 h-4" />}
              </div>
            </div>
            
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-mono font-bold leading-none">{card.value}</span>
              <span className="text-sm font-mono text-muted-foreground mb-1">{card.detail}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
