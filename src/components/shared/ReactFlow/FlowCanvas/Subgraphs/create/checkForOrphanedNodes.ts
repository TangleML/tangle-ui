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

  const taskNodesByTaskId = new Map<string, Node>();
  const inputNodesByName = new Map<string, Node>();
  const selectedTaskIds = new Set<string>();
  const selectedInputNames = new Set<string>();

  selectedNodes.forEach((node) => {
    if (node.type === "task") {
      const taskId = node.data.taskId;
      if (taskId && typeof taskId === "string") {
        taskNodesByTaskId.set(taskId, node);
        selectedTaskIds.add(taskId);
      }
    } else if (node.type === "input") {
      const inputName = node.data.label;
      if (inputName && typeof inputName === "string") {
        inputNodesByName.set(inputName, node);
        selectedInputNames.add(inputName);
      }
    }
  });

  const connectedNodeIds = new Set<string>();

  selectedNodes
    .filter(
      (node): node is Node & { type: "task"; data: { taskId: string } } =>
        node.type === "task",
    )
    .forEach((taskNode) => {
      const taskId = taskNode.data.taskId;
      const task = currentGraphSpec.tasks[taskId];

      if (!task?.arguments) return;

      // Check each argument to see if it connects to another selected node
      Object.values(task.arguments).forEach((argument: ArgumentType) => {
        if (isTaskOutputArgument(argument)) {
          const sourceTaskId = argument.taskOutput.taskId;
          if (selectedTaskIds.has(sourceTaskId)) {
            connectedNodeIds.add(taskNode.id);
            const sourceTaskNode = taskNodesByTaskId.get(sourceTaskId);
            if (sourceTaskNode) {
              connectedNodeIds.add(sourceTaskNode.id);
            }
          }
        } else if (isGraphInputArgument(argument)) {
          const inputName = argument.graphInput.inputName;
          if (selectedInputNames.has(inputName)) {
            connectedNodeIds.add(taskNode.id);
            const inputNode = inputNodesByName.get(inputName);
            if (inputNode) {
              connectedNodeIds.add(inputNode.id);
            }
          }
        }
      });
    });

  // Check output node connections within the selection
  selectedNodes
    .filter(
      (node): node is Node & { type: "output"; data: { label: string } } =>
        node.type === "output",
    )
    .forEach((outputNode) => {
      const outputName = outputNode.data.label;
      const outputValue = currentGraphSpec.outputValues?.[outputName];

      if (outputValue && isTaskOutputArgument(outputValue)) {
        const sourceTaskId = outputValue.taskOutput.taskId;
        if (selectedTaskIds.has(sourceTaskId)) {
          connectedNodeIds.add(outputNode.id);
          const sourceTaskNode = taskNodesByTaskId.get(sourceTaskId);
          if (sourceTaskNode) {
            connectedNodeIds.add(sourceTaskNode.id);
          }
        }
      }
    });

  const orphanedNodes = selectedNodes.filter(
    (node) => !connectedNodeIds.has(node.id) && node.type !== "flex",
  );

  return orphanedNodes;
};
