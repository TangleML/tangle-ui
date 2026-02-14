import { Position } from "@xyflow/react";

import type {
  BuildingInput,
  BuildingInstance,
  BuildingOutput,
} from "../types/buildings";

// Rotate position clockwise
const rotatePosition = (position?: Position): Position | undefined => {
  if (!position) return undefined;

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

export const rotateBuilding = (
  building: BuildingInstance,
): BuildingInstance => {
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
