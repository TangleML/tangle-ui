import { type Node, type XYPosition } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";
import { setPositionInAnnotations } from "@/utils/annotations";
import {
  type ComponentSpec,
  type GraphInputArgument,
  type InputSpec,
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
  type OutputSpec,
  type TaskOutputArgument,
  type TaskSpec,
} from "@/utils/componentSpec";
import { createInputNode } from "@/utils/nodes/createInputNode";
import { createOutputNode } from "@/utils/nodes/createOutputNode";
import { createTaskNode } from "@/utils/nodes/createTaskNode";
import {
  inputNameToNodeId,
  nodeIdToInputName,
  nodeIdToOutputName,
  nodeIdToTaskId,
  outputNameToNodeId,
  taskIdToNodeId,
} from "@/utils/nodes/nodeIdUtils";
import {
  getUniqueInputName,
  getUniqueOutputName,
  getUniqueTaskName,
} from "@/utils/unique";

import {
  getFlexNode,
  updateFlexNodeInComponentSpec,
} from "../FlexNode/interface";
import type { FlexNodeData } from "../FlexNode/types";
import { createFlexNode } from "../FlexNode/utils";
import { isFlexNode } from "../types";
import addFlexNode from "./addFlexNode";
import { getNodesBounds } from "./geometry";

const OFFSET = 10;

/*
  config.connection:
    none = all links between nodes will be removed
    internal = duplicated nodes will maintain links with each other, but not with nodes outside the group
    external = duplicated nodes will maintain links with nodes outside the group, but not with each other
    all = duplicated nodes will maintain all links between nodes within the group and to any nodes with a valid id outside the group
*/
type ConnectionMode = "none" | "internal" | "external" | "all";

export const duplicateNodes = (
  componentSpec: ComponentSpec,
  nodesToDuplicate: Node[],
  config?: {
    selected?: boolean;
    position?: XYPosition;
    connection?: ConnectionMode;
    status?: boolean;
    author?: string;
  },
) => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    throw new Error("ComponentSpec does not contain a graph implementation.");
  }

  const graphSpec = componentSpec.implementation.graph;

  const nodeIdMap: Record<string, string> = {};

  const newTasks: Record<string, TaskSpec> = {};
  const newInputs: Record<string, InputSpec> = {};
  const newOutputs: Record<string, OutputSpec> = {};
  const newFlexNodes: Record<string, FlexNodeData> = {};

  // Default Config
  const selected = config?.selected ?? true;
  const connection = config?.connection ?? "all";
  const author = config?.author ?? "system";

  /* Create new Nodes and map old Task IDs to new Task IDs */
  nodesToDuplicate.forEach((node) => {
    const oldNodeId = node.id;

    if (node.type === "task") {
      const oldTaskId = nodeIdToTaskId(oldNodeId);
      const newTaskId = getUniqueTaskName(graphSpec, oldTaskId);
      const newNodeId = taskIdToNodeId(newTaskId);

      nodeIdMap[oldNodeId] = newNodeId;

      const taskSpec = node.data.taskSpec as TaskSpec;
      const annotations = taskSpec.annotations || {};

      const updatedAnnotations = setPositionInAnnotations(annotations, {
        x: node.position.x + OFFSET,
        y: node.position.y + OFFSET,
      });

      const newTaskSpec = {
        ...taskSpec,
        annotations: updatedAnnotations,
      };
      newTasks[newTaskId] = newTaskSpec;
    } else if (node.type === "input") {
      const inputSpec = componentSpec.inputs?.find(
        (input) => input.name === node.data.label,
      );

      const newInputId = getUniqueInputName(componentSpec, inputSpec?.name);

      const newNodeId = inputNameToNodeId(newInputId);

      nodeIdMap[oldNodeId] = newNodeId;

      const annotations = inputSpec?.annotations || {};

      const updatedAnnotations = setPositionInAnnotations(annotations, {
        x: node.position.x + OFFSET,
        y: node.position.y + OFFSET,
      });

      const newInputSpec = {
        ...inputSpec,
        name: newInputId,
        annotations: updatedAnnotations,
      };

      newInputs[newInputId] = newInputSpec;
    } else if (node.type === "output") {
      const outputSpec = componentSpec.outputs?.find(
        (output) => output.name === node.data.label,
      );

      const newOutputId = getUniqueOutputName(componentSpec, outputSpec?.name);

      const newNodeId = outputNameToNodeId(newOutputId);

      nodeIdMap[oldNodeId] = newNodeId;

      const annotations = outputSpec?.annotations || {};

      const updatedAnnotations = setPositionInAnnotations(annotations, {
        x: node.position.x + OFFSET,
        y: node.position.y + OFFSET,
      });

      const newOutputSpec = {
        ...outputSpec,
        name: newOutputId,
        annotations: updatedAnnotations,
      };

      newOutputs[newOutputId] = newOutputSpec;
    } else if (isFlexNode(node)) {
      const flexNode = getFlexNode(node.id, componentSpec);
      const { spec: updatedComponentSpec, nodeId: newNodeId } = addFlexNode(
        {
          x: node.position.x + OFFSET,
          y: node.position.y + OFFSET,
        },
        author,
        componentSpec,
        flexNode ? { ...flexNode, id: undefined } : undefined,
      );

      const newNodeData = getFlexNode(newNodeId, updatedComponentSpec);
      if (!newNodeData) {
        throw new Error("Failed to retrieve newly created Flex Node data.");
      }

      newFlexNodes[newNodeId] = newNodeData;
      nodeIdMap[oldNodeId] = newNodeId;
    } else {
      throw new Error(`Unsupported node type: ${node.type}`);
    }
  });

  /* Copy over Arguments to the new Tasks */
  Object.entries(newTasks).forEach((tasks) => {
    const [taskId, taskSpec] = tasks;

    if (taskSpec.arguments) {
      Object.entries(taskSpec.arguments).forEach(([argKey, argument]) => {
        const newTaskSpec = newTasks[taskId];

        // Check if the Argument is a connection to another Task or Input Node (i.e. TaskOutput or GraphInput) or a static value
        if (isTaskOutputArgument(argument) || isGraphInputArgument(argument)) {
          newTasks[taskId] = reconfigureConnections(
            newTaskSpec,
            argKey,
            argument,
            nodeIdMap,
            nodesToDuplicate,
            componentSpec,
            connection,
          );
        } else {
          // If the Argument is not a TaskOutput or GraphInput, copy it over
          newTasks[taskId] = {
            ...newTaskSpec,
            arguments: {
              ...newTaskSpec.arguments,
              [argKey]: argument,
            },
          };
        }
      });
    }
  });

  // Outputs are defined in the graph spec
  const updatedGraphOutputs = { ...graphSpec.outputValues };
  if (connection !== "none") {
    /* Reconfigure Outputs */
    Object.entries(newOutputs).forEach((output) => {
      const [outputId] = output;
      const newNodeId = outputNameToNodeId(outputId);
      const oldNodeId = Object.keys(nodeIdMap).find(
        (key) => nodeIdMap[key] === newNodeId,
      );

      if (!oldNodeId) {
        return;
      }

      const oldOutputId = nodeIdToOutputName(oldNodeId);

      if (!graphSpec.outputValues) {
        return;
      }

      const outputValue = graphSpec.outputValues[oldOutputId];

      if (!outputValue) {
        return;
      }

      const updatedOutputValue = { ...outputValue };

      // If the outputvalue references a task that was also duplicated (internal connection), we need to update it to refer to the duplicated task id
      let isInternal = false;
      if (
        typeof updatedOutputValue === "object" &&
        updatedOutputValue !== null &&
        connection !== "external"
      ) {
        if (isTaskOutputArgument(updatedOutputValue)) {
          const oldTaskId = updatedOutputValue.taskOutput.taskId;
          const oldTaskNodeId = taskIdToNodeId(oldTaskId);
          if (oldTaskNodeId in nodeIdMap) {
            const newTaskId = nodeIdToTaskId(nodeIdMap[oldTaskNodeId]);
            updatedOutputValue.taskOutput = {
              ...updatedOutputValue.taskOutput,
              taskId: newTaskId,
            };

            isInternal = true;
          }
        }
      }

      if (
        (isInternal && connection === "internal") ||
        (!isInternal && connection === "external") ||
        connection === "all"
      ) {
        updatedGraphOutputs[outputId] = updatedOutputValue;
      }
    });
  }

  /* Update the Graph Spec & Inputs */
  const updatedTasks = { ...graphSpec.tasks, ...newTasks };
  const updatedGraphSpec = {
    ...graphSpec,
    tasks: updatedTasks,
    outputValues: updatedGraphOutputs,
  };

  const updatedInputs = [
    ...(componentSpec.inputs ?? []),
    ...Object.values(newInputs),
  ];

  const updatedOutputs = [
    ...(componentSpec.outputs ?? []),
    ...Object.values(newOutputs),
  ];

  /* Create new Nodes for the new Tasks */
  const updatedNodes: Node[] = [];

  const newNodes = Object.entries(nodeIdMap)
    .map(([oldNodeId, newNodeId]) => {
      const originalNode = nodesToDuplicate.find(
        (node) => node.id === oldNodeId,
      );
      if (!originalNode) {
        return null;
      }

      const originalNodeData = originalNode.data as TaskNodeData;

      if (originalNode.type === "task") {
        const newTaskId = nodeIdToTaskId(newNodeId);

        const newTaskSpec = updatedGraphSpec.tasks[newTaskId];

        const newNode = createTaskNode(
          [newTaskId, newTaskSpec],
          originalNodeData,
        );

        newNode.id = newNodeId;
        newNode.selected = false;

        // Move selection to new node by default
        if (selected) {
          originalNode.selected = false;
          newNode.selected = true;
        }

        newNode.measured = originalNode.measured;

        updatedNodes.push(originalNode);

        return newNode;
      } else if (originalNode.type === "input") {
        const newInputId = nodeIdToInputName(newNodeId);
        const newInputSpec = updatedInputs.find(
          (input) => input.name === newInputId,
        );

        if (!newInputSpec) {
          return null;
        }

        const newNode = createInputNode(newInputSpec, originalNodeData);

        newNode.id = newNodeId;
        newNode.selected = false;

        // Move selection to new node by default
        if (selected) {
          originalNode.selected = false;
          newNode.selected = true;
        }

        newNode.measured = originalNode.measured;

        updatedNodes.push(originalNode);

        return newNode;
      } else if (originalNode.type === "output") {
        const newOutputId = nodeIdToOutputName(newNodeId);
        const newOutputSpec = updatedOutputs.find(
          (output) => output.name === newOutputId,
        );

        if (!newOutputSpec) {
          return null;
        }

        const newNode = createOutputNode(newOutputSpec, originalNodeData);

        newNode.id = newNodeId;

        // Move selection to new node by default
        if (selected) {
          originalNode.selected = false;
          newNode.selected = true;
        }

        newNode.measured = originalNode.measured;

        updatedNodes.push(originalNode);

        return newNode;
      } else if (isFlexNode(originalNode)) {
        const newNodeData = newFlexNodes[newNodeId];

        if (!newNodeData) {
          return null;
        }

        const newNode = createFlexNode(newNodeData);

        newNode.id = newNodeId;

        // Move selection to new node by default
        if (selected) {
          originalNode.selected = false;
          newNode.selected = true;
        }

        newNode.measured = originalNode.measured;

        updatedNodes.push(originalNode);

        return newNode;
      }
    })
    .filter(Boolean) as Node[];

  /* Position the new Nodes with layout preserved and centered on the given position */
  if (config?.position) {
    const bounds = getNodesBounds(newNodes);
    const currentCenter = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    const offset = {
      x: config.position.x - currentCenter.x,
      y: config.position.y - currentCenter.y,
    };

    // Shift Nodes to the new position
    newNodes.forEach((node) => {
      const newPosition = {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      };

      if (node.type === "task") {
        const taskId = nodeIdToTaskId(node.id);

        const taskSpec = node.data.taskSpec as TaskSpec;
        const annotations = taskSpec.annotations || {};

        const updatedAnnotations = setPositionInAnnotations(
          annotations,
          newPosition,
        );

        const newTaskSpec = {
          ...taskSpec,
          annotations: updatedAnnotations,
        };

        updatedGraphSpec.tasks[taskId] = newTaskSpec;
      } else if (node.type === "input") {
        const inputId = nodeIdToInputName(node.id);

        const inputSpec = updatedInputs.find((input) => input.name === inputId);

        if (!inputSpec) {
          return;
        }

        const annotations = inputSpec.annotations || {};

        const updatedAnnotations = setPositionInAnnotations(
          annotations,
          newPosition,
        );

        const newInputSpec: InputSpec = {
          ...inputSpec,
          annotations: updatedAnnotations,
        };

        const updatedInputIndex = updatedInputs.findIndex(
          (input) => input.name === inputId,
        );

        if (updatedInputIndex !== -1) {
          updatedInputs[updatedInputIndex] = newInputSpec;
        }
      } else if (node.type === "output") {
        const outputId = nodeIdToOutputName(node.id);

        const outputSpec = updatedOutputs.find(
          (output) => output.name === outputId,
        );

        if (!outputSpec) {
          return;
        }

        const annotations = outputSpec.annotations || {};

        const updatedAnnotations = setPositionInAnnotations(
          annotations,
          newPosition,
        );

        const newOutputSpec: OutputSpec = {
          ...outputSpec,
          annotations: updatedAnnotations,
        };

        const updatedOutputIndex = updatedOutputs.findIndex(
          (output) => output.name === outputId,
        );

        if (updatedOutputIndex !== -1) {
          updatedOutputs[updatedOutputIndex] = newOutputSpec;
        }
      } else if (isFlexNode(node)) {
        const newFlexNodeData = newFlexNodes[node.id];

        if (!newFlexNodeData) {
          return;
        }

        newFlexNodes[node.id] = {
          ...newFlexNodeData,
          position: newPosition,
        };
      }

      node.position = newPosition;
    });
  }

  const updatedComponentSpec: ComponentSpec = {
    ...componentSpec,
    inputs: updatedInputs,
    outputs: updatedOutputs,
  };

  if (isGraphImplementation(updatedComponentSpec.implementation)) {
    updatedComponentSpec.implementation.graph = updatedGraphSpec;
  }

  /* Handle Flex Nodes */
  let spec = updatedComponentSpec;
  Object.values(newFlexNodes).forEach((newNodeData) => {
    spec = updateFlexNodeInComponentSpec(spec, newNodeData);
  });

  return { updatedComponentSpec: spec, nodeIdMap, newNodes, updatedNodes };
};

function reconfigureConnections(
  taskSpec: TaskSpec,
  argKey: string,
  argument: TaskOutputArgument | GraphInputArgument,
  nodeIdMap: Record<string, string>,
  nodes: Node[],
  componentSpec: ComponentSpec,
  mode: ConnectionMode,
) {
  let oldNodeId = undefined;
  let newArgId = undefined;
  let isExternal = false;

  if (isTaskOutputArgument(argument)) {
    const oldTaskId = argument.taskOutput.taskId;
    oldNodeId = taskIdToNodeId(oldTaskId);

    if (!isGraphImplementation(componentSpec.implementation)) {
      throw new Error("ComponentSpec does not contain a graph implementation.");
    }

    const graphSpec = componentSpec.implementation.graph;
    isExternal = oldTaskId in graphSpec.tasks;

    const newNodeId = nodeIdMap[oldNodeId];

    if (!newNodeId) {
      return reconfigureExternalConnection(taskSpec, argKey, mode);
    }

    const newTaskId = nodeIdToTaskId(newNodeId);

    newArgId = newTaskId;
  } else if (isGraphInputArgument(argument)) {
    const oldInputId = argument.graphInput.inputName;
    oldNodeId = inputNameToNodeId(oldInputId);

    if (!("inputs" in componentSpec)) {
      throw new Error("ComponentSpec does not contain inputs.");
    }

    const inputs = componentSpec.inputs || [];
    isExternal = inputs.some((input) => input.name === oldInputId);

    const newNodeId = nodeIdMap[oldNodeId];

    if (!newNodeId) {
      return reconfigureExternalConnection(taskSpec, argKey, mode);
    }

    const newInputId = nodeIdToInputName(newNodeId);

    newArgId = newInputId;
  }

  if (!newArgId) {
    return reconfigureExternalConnection(taskSpec, argKey, mode);
  }

  const isInternal = nodes.some((node) => node.id === oldNodeId);

  const specWithRemovedArg = removeArgumentFromTaskSpec(taskSpec, argKey);
  const specWithReconfiguredArg = updateTaskArgumentConnection(
    taskSpec,
    argKey,
    argument,
    newArgId,
  );

  switch (mode) {
    case "none":
      // Remove all links
      return specWithRemovedArg;
    case "internal":
      // Maintain links only between duplicated nodes
      return isInternal ? specWithReconfiguredArg : specWithRemovedArg;
    case "external":
      // Maintain links only to original nodes outside the group
      return isExternal && !isInternal ? taskSpec : specWithRemovedArg;
    case "all":
      // Maintain all links
      if (isInternal) {
        return specWithReconfiguredArg;
      } else if (isExternal) {
        return taskSpec;
      } else {
        return specWithRemovedArg;
      }
  }
}

function reconfigureExternalConnection(
  taskSpec: TaskSpec,
  argKey: string,
  mode: ConnectionMode,
): TaskSpec {
  // The connected node is NOT also part of the duplication operation, so full reconfiguration is not required
  const specWithRemovedArg = removeArgumentFromTaskSpec(taskSpec, argKey);

  if (mode === "internal" || mode === "none") {
    return specWithRemovedArg;
  } else if (mode === "external" || mode === "all") {
    return taskSpec;
  }

  // Fallback - no changes to the task spec
  return taskSpec;
}

function removeArgumentFromTaskSpec(
  taskSpec: TaskSpec,
  argKey: string,
): TaskSpec {
  const updatedTaskSpec = {
    ...taskSpec,
    arguments: Object.fromEntries(
      Object.entries(taskSpec.arguments ?? {}).filter(
        ([key]) => key !== argKey,
      ),
    ),
  };
  return updatedTaskSpec;
}

function updateTaskArgumentConnection(
  taskSpec: TaskSpec,
  argKey: string,
  argument: TaskOutputArgument | GraphInputArgument,
  newArgId: string,
): TaskSpec {
  if (isTaskOutputArgument(argument)) {
    return {
      ...taskSpec,
      arguments: {
        ...taskSpec.arguments,
        [argKey]: {
          ...argument,
          taskOutput: {
            ...argument.taskOutput,
            taskId: newArgId,
          },
        },
      },
    };
  } else if (isGraphInputArgument(argument)) {
    return {
      ...taskSpec,
      arguments: {
        ...taskSpec.arguments,
        [argKey]: {
          ...argument,
          graphInput: {
            ...argument.graphInput,
            inputName: newArgId,
          },
        },
      },
    };
  }

  // fallback - no changes
  return taskSpec;
}
