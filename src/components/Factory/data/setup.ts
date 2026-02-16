import type { XYPosition } from "@xyflow/react";

import type { BuildingType } from "../types/buildings";
import type { ResourceType } from "../types/resources";
import type { GlobalResourceType } from "./resources";

export type BuildingSetup = {
  type: BuildingType;
  position: XYPosition;
  setupId?: string;
};

type ResourceSetup = {
  type: GlobalResourceType;
  amount: number;
};

export type ConnectionSetup = {
  source: string;
  target: string;
  resource?: ResourceType;
};

interface setup {
  buildings?: BuildingSetup[];
  resources?: ResourceSetup[];
  connections?: ConnectionSetup[];
}

const buildings: BuildingSetup[] = [
  { type: "firepit", position: { x: 0, y: 0 }, setupId: "firepit-1" },
  { type: "foraging", position: { x: -300, y: 0 }, setupId: "foraging-1" },
  {
    type: "woodcutter",
    position: { x: -300, y: -200 },
    setupId: "woodcutter-1",
  },
  {
    type: "tradingpost",
    position: { x: 0, y: -200 },
    setupId: "tradingpost-1",
  },
];

const resources: ResourceSetup[] = [
  { type: "money", amount: 1000 },
  { type: "food", amount: 200 },
];

const connections: ConnectionSetup[] = [
  {
    source: "foraging-1",
    target: "firepit-1",
  },
  {
    source: "woodcutter-1",
    target: "tradingpost-1",
  },
];

export const setup: setup = {
  buildings,
  resources,
  connections,
};
