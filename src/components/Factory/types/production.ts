import type { ResourceType } from "./resources";

export type ProductionMethod = {
  name: string;
  inputs: Array<{
    resource: ResourceType;
    amount: number;
    nodes?: number;
  }>;
  outputs: Array<{
    resource: ResourceType;
    amount: number;
    nodes?: number;
  }>;
  days: number;
};

type ProductionStatus = "idle" | "active" | "paused" | "complete";

export type ProductionState = {
  progress: number;
  status: ProductionStatus;
};
