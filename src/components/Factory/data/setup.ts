import type { XYPosition } from "@xyflow/react";

import type { BuildingType } from "../types/buildings";

type BuildingSetup = {
  type: BuildingType;
  position: XYPosition;
};
interface setup {
  buildings?: BuildingSetup[];
}

const buildings: BuildingSetup[] = [
  { type: "marketplace", position: { x: 0, y: 0 } },
];

export const setup: setup = {
  buildings,
};
