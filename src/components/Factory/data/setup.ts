import type { XYPosition } from "@xyflow/react";

import type { BuildingType } from "../types/buildings";
import type { GlobalResourceType } from "./resources";

type BuildingSetup = {
  type: BuildingType;
  position: XYPosition;
};

type ResourceSetup = {
  type: GlobalResourceType;
  amount: number;
};

interface setup {
  buildings?: BuildingSetup[];
  resources?: ResourceSetup[];
}

const buildings: BuildingSetup[] = [
  { type: "firepit", position: { x: 0, y: 0 } },
];

const resources: ResourceSetup[] = [
  { type: "money", amount: 1000 },
  { type: "food", amount: 200 },
];

export const setup: setup = {
  buildings,
  resources,
};
