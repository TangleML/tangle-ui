import type { Node, Position } from "@xyflow/react";

import { BUILDINGS } from "../data/buildings";
import type { ProductionMethod, ProductionState } from "./production";
import type { ResourceType } from "./resources";

export type BuildingInput = {
  resource: ResourceType;
  position?: Position;
};

export type BuildingOutput = {
  resource: ResourceType;
  position?: Position;
};

export type Stockpile = {
  resource: ResourceType;
  amount: number;
  maxAmount: number;
  breakdown?: Map<ResourceType, number>;
};

export interface BuildingClass {
  name: string;
  icon: string;
  description: string;
  cost: number;
  color: string;
  productionMethods: ProductionMethod[];
}

export interface BuildingInstance extends Omit<
  BuildingClass,
  "productionMethods"
> {
  id: string;
  type: BuildingType;
  inputs: BuildingInput[];
  outputs: BuildingOutput[];
  stockpile: Stockpile[];
  productionMethod: ProductionMethod;
  productionState: ProductionState;
}

export type BuildingNodeData = Record<string, unknown> & {
  buildingInstance: BuildingInstance;
};

export function getBuildingType(buildingType: string): BuildingClass {
  const building = BUILDINGS[buildingType];

  if (!building) {
    throw new Error(`Building type ${buildingType} not found`);
  }

  return building;
}

export function isBuildingInstance(node: Node): node is Node;
export function isBuildingInstance(data: any): data is BuildingInstance;

// Implementation
export function isBuildingInstance(nodeOrData: any): boolean {
  if (
    nodeOrData !== null &&
    typeof nodeOrData === "object" &&
    "data" in nodeOrData
  ) {
    const data = nodeOrData.data;
    return isBuildingInstanceData(data);
  }

  return isBuildingInstanceData(nodeOrData);
}

function isBuildingInstanceData(data: any): data is BuildingInstance {
  return (
    data !== null &&
    typeof data === "object" &&
    typeof data.id === "string" &&
    typeof data.type === "string" &&
    typeof data.name === "string" &&
    typeof data.icon === "string" &&
    typeof data.description === "string" &&
    typeof data.cost === "number" &&
    typeof data.color === "string" &&
    Array.isArray(data.inputs) &&
    Array.isArray(data.outputs) &&
    Array.isArray(data.stockpile) &&
    typeof data.productionMethod === "object" &&
    typeof data.productionState === "object"
  );
}

export function getBuildingInstance(
  node: Node | undefined,
): BuildingInstance | null;
export function getBuildingInstance(
  data: Record<string, unknown>,
): BuildingInstance | null;

// Implementation
export function getBuildingInstance(
  nodeOrData: Node | undefined | Record<string, unknown>,
): BuildingInstance | null {
  if (!nodeOrData) return null;

  // Node
  if ("data" in nodeOrData && typeof nodeOrData.data === "object") {
    const node = nodeOrData as Node;
    if (node.data && isBuildingInstance(node.data.buildingInstance)) {
      return node.data.buildingInstance;
    }
    return null;
  }

  // Data
  const data = nodeOrData as Record<string, unknown>;
  if (isBuildingInstance(data.buildingInstance)) {
    return data.buildingInstance;
  }

  return null;
}

export type BuildingType = keyof typeof BUILDINGS;
export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];
