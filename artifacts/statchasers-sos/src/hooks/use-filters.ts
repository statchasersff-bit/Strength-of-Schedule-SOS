import { useState } from "react";
import {
  GetTeamSosPosition,
  GetTeamSosScoring,
  GetTeamSosView,
  GetTeamSosMetric,
} from "@workspace/api-client-react";

export interface FilterState {
  season: number;
  position: GetTeamSosPosition;
  scoring: GetTeamSosScoring;
  view: GetTeamSosView;
  metric: GetTeamSosMetric;
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>({
    season: 2026,
    position: GetTeamSosPosition.RB,
    scoring: GetTeamSosScoring.PPR,
    view: GetTeamSosView.FULL_SEASON,
    metric: GetTeamSosMetric.RANK,
  });

  return { filters, setFilters };
}
