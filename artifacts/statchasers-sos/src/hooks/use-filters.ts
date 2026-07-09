import { useState } from "react";
import {
  GetTeamSosPosition,
  GetTeamSosScoring,
  GetTeamSosMetric,
} from "@workspace/api-client-react";

export interface FilterState {
  season: number;
  position: GetTeamSosPosition;
  scoring: GetTeamSosScoring;
  metric: GetTeamSosMetric;
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>({
    // Season is fixed to 2026 (the only built dataset); no UI control.
    season: 2026,
    position: GetTeamSosPosition.RB,
    scoring: GetTeamSosScoring.PPR,
    metric: GetTeamSosMetric.RANK,
  });

  return { filters, setFilters };
}
