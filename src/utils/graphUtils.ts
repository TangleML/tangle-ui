import type { XYPosition } from "@xyflow/react";

import {
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
} from "./componentSpec";
import { extractPositionFromAnnotations } from "./nodes/extractPositionFromAnnotations";

export const calculateSpecCenter = (
  componentSpec: ComponentSpec,
): XYPosition => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return { x: 0, y: 0 };
  }

  const graphSpec: GraphSpec = componentSpec.implementation.graph;

  const allPositions: XYPosition[] = [];

  // Collect positions from tasks
  Object.values(graphSpec.tasks).forEach((task) => {
    const taskPosition = extractPositionFromAnnotations(task.annotations);
    if (taskPosition) {
      allPositions.push(taskPosition);
    }
  });

  // Collect positions from inputs
  componentSpec.inputs?.forEach((input) => {
    const inputPosition = extractPositionFromAnnotations(input.annotations);
    if (inputPosition) {
      allPositions.push(inputPosition);
    }
  });

  // Collect positions from outputs
  componentSpec.outputs?.forEach((output) => {
    const outputPosition = extractPositionFromAnnotations(output.annotations);
    if (outputPosition) {
      allPositions.push(outputPosition);
    }
  });

  if (allPositions.length === 0) {
    return { x: 0, y: 0 };
  }

  const sumX = allPositions.reduce((sum, pos) => sum + pos.x, 0);
  const sumY = allPositions.reduce((sum, pos) => sum + pos.y, 0);

  return {
    x: sumX / allPositions.length,
    y: sumY / allPositions.length,
  };
};

export const normalizeNodePositionInGroup = (
  nodePosition: XYPosition | undefined,
  groupPosition: XYPosition | undefined,
  groupCenter: XYPosition,
): XYPosition => ({
  x: (groupPosition?.x || 0) + (nodePosition?.x || 0) - groupCenter.x,
  y: (groupPosition?.y || 0) + (nodePosition?.y || 0) - groupCenter.y,
});
