import { Position } from "@xyflow/react";

import type {
  Building,
  BuildingInput,
  BuildingOutput,
} from "../types/buildings";

// Rotate position clockwise
const rotatePosition = (position: Position): Position => {
  switch (position) {
    case Position.Top:
      return Position.Right;
    case Position.Right:
      return Position.Bottom;
    case Position.Bottom:
      return Position.Left;
    case Position.Left:
      return Position.Top;
    default:
      return position;
  }
};

export const rotateBuilding = (building: Building): Building => {
  const rotatedInputs = building.inputs?.map((input: BuildingInput) => ({
    ...input,
    position: rotatePosition(input.position),
  }));

  const rotatedOutputs = building.outputs?.map((output: BuildingOutput) => ({
    ...output,
    position: rotatePosition(output.position),
  }));

  return {
    ...building,
    inputs: rotatedInputs,
    outputs: rotatedOutputs,
  };
};
