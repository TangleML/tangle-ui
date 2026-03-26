import type { Node, Position } from "@xyflow/react";

import type { IconName } from "@/components/ui/icon";

import type { ProductionMethod, ProductionState } from "./production";
import type { ResourceType } from "./resources";

export type BuildingType =
  | "firepit"
  | "tradingpost"
  | "marketplace"
  | "library"
  | "storagepit"
  | "well"
  | "woodcutter"
  | "quarry"
  | "farm"
  | "sawmill"
  | "papermill"
  | "pasture"
  | "butchery"
  | "bookbinder"
  | "mill"
  | "kiln"
  | "bakery"
  | "bank"
  | "foraging"
  | "fishing"
  | "hunting"
  | "granary"
  | "smelter"
  | "toolsmith"
  | "mine"
  | "mint"
  | "splitter"
  | "merger";

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

export type BuildingCategoryDefinition = {
  type: string;
  label: string;
  icon: IconName;
};

export const BUILDING_CATEGORIES: BuildingCategoryDefinition[] = [
  { type: "special", label: "Special", icon: "Star" },
  { type: "logistics", label: "Logistics", icon: "Truck" },
  { type: "production", label: "Production", icon: "Hammer" },
  { type: "refining", label: "Refining", icon: "Factory" },
  { type: "services", label: "Services", icon: "Store" },
  { type: "storage", label: "Storage", icon: "Package" },
];

export type BuildingCategory = (typeof BUILDING_CATEGORIES)[number]["type"];

export interface BuildingClass {
  name: string;
  icon: string;
  description: string;
  cost: number;
  color: string;
  productionMethods: ProductionMethod[];
  category: BuildingCategory;
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

function isBuildingInstance(data: any): data is BuildingInstance {
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
