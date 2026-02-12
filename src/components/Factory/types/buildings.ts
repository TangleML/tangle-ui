import type { Position } from "@xyflow/react";

import type { ResourceType } from "./resources";

export type BuildingInput = {
  resource: ResourceType;
  position: Position;
};

export type BuildingOutput = {
  resource: ResourceType;
  position: Position;
};

export type BuildingType =
  | "woodcutter"
  | "quarry"
  | "farm"
  | "sawmill"
  | "marketplace";

export interface Building {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost?: number;
  color: string;
  inputs?: BuildingInput[];
  outputs?: BuildingOutput[];
}

export function isBuildingData(data: any): data is Building {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    typeof data.icon === "string" &&
    typeof data.description === "string" &&
    typeof data.color === "string"
  );
}
