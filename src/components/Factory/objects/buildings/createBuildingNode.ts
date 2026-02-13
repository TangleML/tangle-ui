import type { Node, XYPosition } from "@xyflow/react";

import type { BuildingType } from "../../types/buildings";
import { createBuildingInstance } from "./createBuildingInstance";

export const createBuildingNode = (
  buildingType: BuildingType,
  position: XYPosition,
  productionMethodIndex: number = 0,
): Node => {
  const buildingInstance = createBuildingInstance(
    buildingType,
    productionMethodIndex,
  );

  const newNode: Node = {
    id: buildingInstance.id,
    type: "building",
    position,
    data: { buildingInstance: buildingInstance },
    draggable: true,
    deletable: true,
    selectable: true,
  };

  return newNode;
};
