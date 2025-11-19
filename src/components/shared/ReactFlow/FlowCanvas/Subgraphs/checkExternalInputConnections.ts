import type { Node } from "@xyflow/react";

import type { ComponentSpec } from "@/utils/componentSpec";
import {
  isGraphImplementation,
  isGraphInputArgument,
} from "@/utils/componentSpec";

export const checkExternalInputConnections = (
  selectedNodes: Node[],
  componentSpec: ComponentSpec,
): Node[] => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return [];
  }

  const currentGraphSpec = componentSpec.implementation.graph;
  const selectedInputNodes = selectedNodes.filter(
    (node) => node.type === "input",
  );

  const selectedTaskIds = new Set(
    selectedNodes
      .filter(
        (node): node is Node & { type: "task"; data: { taskId: string } } =>
          node.type === "task",
      )
      .map((node) => node.data.taskId),
  );

  const inputsWithExternalConnections = selectedInputNodes
    .filter(
      (node): node is Node & { type: "input"; data: { label: string } } =>
        node.type === "input",
    )
    .filter((node) => {
      const inputName = node.data.label;

      const isConnectedExternally = Object.entries(currentGraphSpec.tasks).some(
        ([taskId, taskSpec]) => {
          if (selectedTaskIds.has(taskId)) {
            return false;
          }

          if (taskSpec.arguments) {
            return Object.values(taskSpec.arguments).some(
              (arg) =>
                isGraphInputArgument(arg) &&
                arg.graphInput.inputName === inputName,
            );
          }
          return false;
        },
      );

      return isConnectedExternally;
    });

  return inputsWithExternalConnections;
};
