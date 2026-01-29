import type { XYPosition } from "@xyflow/react";

import { extractPositionFromAnnotations } from "./annotations";
import {
  type ArgumentType,
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
  type TaskOutputArgument,
} from "./componentSpec";

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

export const getArgumentsWithUpstreamConnections = (
  taskId: string,
  graphSpec: GraphSpec,
) => {
  const taskSpec = graphSpec.tasks[taskId];
  if (!taskSpec) {
    return {};
  }

  const taskArguments = taskSpec.arguments || {};

  return Object.entries(taskArguments).reduce<Record<string, ArgumentType>>(
    (acc, [inputName, argValue]) => {
      if (isTaskOutputArgument(argValue)) {
        const taskId = argValue.taskOutput.taskId;
        if (graphSpec.tasks[taskId]) {
          acc[inputName] = argValue;
        }
      } else if (isGraphInputArgument(argValue)) {
        acc[inputName] = argValue;
      }
      return acc;
    },
    {},
  );
};

export const getOutputNodesConnectedToTask = (
  taskId: string,
  graphSpec: GraphSpec,
) => {
  return Object.entries(graphSpec.outputValues || {}).reduce<
    Record<string, TaskOutputArgument>
  >((acc, [outputName, outputValue]) => {
    if (
      isTaskOutputArgument(outputValue) &&
      outputValue.taskOutput.taskId === taskId
    ) {
      acc[outputName] = outputValue;
    }
    return acc;
  }, {});
};

export const getDownstreamTaskNodesConnectedToTask = (
  taskId: string,
  graphSpec: GraphSpec,
) => {
  return Object.entries(graphSpec.tasks).reduce<
    Record<string, Record<string, TaskOutputArgument>>
  >((acc, [graphTaskId, taskSpec]) => {
    const taskArguments = taskSpec.arguments || {};
    const connectedArgs: Record<string, TaskOutputArgument> = {};

    Object.entries(taskArguments).forEach(([argName, argValue]) => {
      if (
        isTaskOutputArgument(argValue) &&
        argValue.taskOutput.taskId === taskId
      ) {
        connectedArgs[argName] = argValue;
      }
    });

    if (Object.keys(connectedArgs).length > 0) {
      acc[graphTaskId] = connectedArgs;
    }

    return acc;
  }, {});
};
