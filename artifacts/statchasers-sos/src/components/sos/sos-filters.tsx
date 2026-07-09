import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterState } from "@/hooks/use-filters";
import {
  GetTeamSosPosition,
  GetTeamSosScoring,
} from "@workspace/api-client-react";

interface SosFiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

/** "HALF_PPR" -> "Half PPR" for display. */
const prettyScoring = (s: string) => s.replace("_", " ");

const POSITIONS = Object.values(GetTeamSosPosition).filter((p) => p !== "K" && p !== "DST");
const SCORINGS = Object.values(GetTeamSosScoring);

/**
 * App-style mobile filter pill: small uppercase label stacked over the bold
 * selected value, with a transparent native <select> overlaid so tapping the
 * pill opens the system picker. Letter-spacing is applied to the label only —
 * the value uses normal tracking so "PPR" doesn't render as "P P R".
 */
function FilterPill({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <label className="relative flex-none min-w-[104px] min-h-[44px] flex items-center gap-2 px-3 rounded-xl border border-border bg-card shadow-sm active:bg-muted/40">
      <span className="flex flex-col items-start">
        <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-muted-foreground">{label}</span>
        <strong className="mt-1 text-sm font-extrabold leading-none tracking-normal whitespace-nowrap text-foreground">{value}</strong>
      </span>
      <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      {children}
    </label>
  );
}

export function SosFilters({ filters, setFilters, activeTab, setActiveTab }: SosFiltersProps) {
  const selectClass =
    "bg-transparent text-sm font-semibold text-foreground cursor-pointer focus:outline-none";
  // Match the filter pill: flush, divided segments; active segment filled.
  const triggerClass =
    "rounded-none px-4 py-2 min-h-[42px] text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none";
  // Transparent native select layered over a pill so the whole pill is tappable.
  const overlaySelect = "absolute inset-0 h-full w-full cursor-pointer opacity-0";

  return (
    <div className="w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-[1440px] mx-auto px-[5px] flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:h-16 md:py-0">
        {/* View tabs share the header row with the filter group. */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-2 w-full md:w-[280px] h-auto p-0 rounded-lg border border-border bg-card shadow-sm divide-x divide-border overflow-hidden">
            <TabsTrigger value="team" className={triggerClass}>Team SOS</TabsTrigger>
            <TabsTrigger value="player" className={triggerClass}>Player SOS</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Desktop: grouped control bar — one pill containing the two filters. */}
        <div className="hidden md:flex flex-wrap items-center divide-x divide-border rounded-lg border border-border bg-card shadow-sm">
          <label className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Position</span>
            <select
              data-testid="select-position"
              className={selectClass}
              value={filters.position}
              onChange={(e) => setFilters({ ...filters, position: e.target.value as GetTeamSosPosition })}
            >
              {POSITIONS.map(p => <option key={p} value={p} className="bg-background text-foreground">{p}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scoring</span>
            <select
              data-testid="select-scoring"
              className={selectClass}
              value={filters.scoring}
              onChange={(e) => setFilters({ ...filters, scoring: e.target.value as GetTeamSosScoring })}
            >
              {SCORINGS.map(s => <option key={s} value={s} className="bg-background text-foreground">{prettyScoring(s)}</option>)}
            </select>
          </label>
        </div>

        {/* Mobile: app-style filter pills, horizontally scrollable, hidden scrollbar. */}
        <div className="flex md:hidden justify-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterPill label="Position" value={filters.position}>
            <select
              data-testid="select-position-mobile"
              aria-label="Position"
              className={overlaySelect}
              value={filters.position}
              onChange={(e) => setFilters({ ...filters, position: e.target.value as GetTeamSosPosition })}
            >
              {POSITIONS.map(p => <option key={p} value={p} className="bg-background text-foreground">{p}</option>)}
            </select>
          </FilterPill>

          <FilterPill label="Scoring" value={prettyScoring(filters.scoring)}>
            <select
              data-testid="select-scoring-mobile"
              aria-label="Scoring"
              className={overlaySelect}
              value={filters.scoring}
              onChange={(e) => setFilters({ ...filters, scoring: e.target.value as GetTeamSosScoring })}
            >
              {SCORINGS.map(s => <option key={s} value={s} className="bg-background text-foreground">{prettyScoring(s)}</option>)}
            </select>
          </FilterPill>
        </div>
      </div>
    </div>
  );
}
