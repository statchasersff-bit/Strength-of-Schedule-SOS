import { Shield } from "lucide-react";
import { FilterState } from "@/hooks/use-filters";
import {
  GetTeamSosPosition,
  GetTeamSosScoring,
  GetTeamSosView,
  GetTeamSosMetric,
} from "@workspace/api-client-react";

interface SosFiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
}

export function SosFilters({ filters, setFilters }: SosFiltersProps) {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">StatChasers <span className="text-primary font-mono text-base uppercase">SOS</span></span>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            data-testid="select-season"
            className="h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.season}
            onChange={(e) => setFilters({ ...filters, season: parseInt(e.target.value) })}
          >
            {[2026, 2025, 2024].map(y => <option key={y} value={y} className="bg-background text-foreground">{y}</option>)}
          </select>

          <select 
            data-testid="select-position"
            className="h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.position}
            onChange={(e) => setFilters({ ...filters, position: e.target.value as GetTeamSosPosition })}
          >
            {Object.values(GetTeamSosPosition).map(p => <option key={p} value={p} className="bg-background text-foreground">{p}</option>)}
          </select>

          <select 
            data-testid="select-scoring"
            className="h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.scoring}
            onChange={(e) => setFilters({ ...filters, scoring: e.target.value as GetTeamSosScoring })}
          >
            {Object.values(GetTeamSosScoring).map(s => <option key={s} value={s} className="bg-background text-foreground">{s.replace('_', ' ')}</option>)}
          </select>

          <select 
            data-testid="select-view"
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.view}
            onChange={(e) => setFilters({ ...filters, view: e.target.value as GetTeamSosView })}
          >
            {Object.values(GetTeamSosView).map(v => <option key={v} value={v} className="bg-background text-foreground">{v.replace(/_/g, ' ')}</option>)}
          </select>

          <select 
            data-testid="select-metric"
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.metric}
            onChange={(e) => setFilters({ ...filters, metric: e.target.value as GetTeamSosMetric })}
          >
            {Object.values(GetTeamSosMetric).map(m => <option key={m} value={m} className="bg-background text-foreground">{m.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
