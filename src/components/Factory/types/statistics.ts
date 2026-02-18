import type { ResourceType } from "./resources";

export interface GlobalStatistics {
  day: number;
  resources: Record<string, number>;
  earned: Record<string, number>;
}

export interface StockpileChange {
  resource: ResourceType;
  added: number;
  removed: number;
  net: number;
}

export interface BuildingStatistics {
  stockpileChanges: StockpileChange[];
  produced?: Record<string, number>;
}

export interface EdgeStatistics {
  transferred: number;
  resource: ResourceType;
}

export interface DayStatistics {
  global: GlobalStatistics;
  buildings: Map<string, BuildingStatistics>;
  edges: Map<string, EdgeStatistics>;
}
