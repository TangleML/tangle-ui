import type { GlobalResources } from "../data/resources";
import type { ResourceType } from "./resources";

export interface GlobalStatistics {
  day: number;
  resources: GlobalResources;
  earned: GlobalResources;
}

export interface StockpileChange {
  resource: ResourceType;
  added: number;
  removed: number;
  net: number;
}

export interface BuildingStatistics {
  stockpileChanges: StockpileChange[];
  produced?: Partial<Record<ResourceType, number>>;
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
