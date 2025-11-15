import type { Node } from "@xyflow/react";

import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import {
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
} from "@/utils/componentSpec";

export const checkForOrphanedNodes = (
  selectedNodes: Node[],
  componentSpec: ComponentSpec,
) => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return [];
  }

  const currentGraphSpec = componentSpec.implementation.graph;
  const selectedTaskIds = new Set(
    selectedNodes
      .filter((node) => node.type === "task")
      .map((node) => node.data.taskId as string),
  );
  const selectedInputNames = new Set(
    selectedNodes
      .filter((node) => node.type === "input")
      .map((node) => node.data.label as string)
      .filter(Boolean),
  );

  const connectedNodeIds = new Set<string>();

  selectedNodes
    .filter((node) => node.type === "task")
    .forEach((taskNode) => {
      const taskId = taskNode.data.taskId as string;
      const task = currentGraphSpec.tasks[taskId];

      if (!task?.arguments) return;

      // Check each argument to see if it connects to another selected node
      Object.values(task.arguments).forEach((argument: ArgumentType) => {
        if (isTaskOutputArgument(argument)) {
          const sourceTaskId = argument.taskOutput.taskId;
          if (selectedTaskIds.has(sourceTaskId)) {
            connectedNodeIds.add(taskNode.id);
            const sourceTaskNode = selectedNodes.find(
              (node) =>
                node.type === "task" && node.data.taskId === sourceTaskId,
            );
            if (sourceTaskNode) {
              connectedNodeIds.add(sourceTaskNode.id);
            }
          }
        } else if (isGraphInputArgument(argument)) {
          const inputName = argument.graphInput.inputName;
          if (selectedInputNames.has(inputName)) {
            connectedNodeIds.add(taskNode.id);
            const inputNode = selectedNodes.find(
              (node) => node.type === "input" && node.data.label === inputName,
            );
            if (inputNode) {
              connectedNodeIds.add(inputNode.id);
            }
          }
        }
      });
    });

  // Check output node connections within the selection
  selectedNodes
    .filter((node) => node.type === "output")
    .forEach((outputNode) => {
      const outputName = outputNode.data.label as string;
      const outputValue = currentGraphSpec.outputValues?.[outputName];

      if (outputValue && isTaskOutputArgument(outputValue)) {
        const sourceTaskId = outputValue.taskOutput.taskId;
        if (selectedTaskIds.has(sourceTaskId)) {
          connectedNodeIds.add(outputNode.id);
          const sourceTaskNode = selectedNodes.find(
            (node) => node.type === "task" && node.data.taskId === sourceTaskId,
          );
          if (sourceTaskNode) {
            connectedNodeIds.add(sourceTaskNode.id);
          }
        }
      }
    });

  const orphanedNodes = selectedNodes.filter(
    (node) => !connectedNodeIds.has(node.id),
  );

  return orphanedNodes;
};
