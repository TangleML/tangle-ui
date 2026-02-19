import { type Node } from "@xyflow/react";

import type { TaskNodeData } from "@/types/taskNode";
import {
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";

import { createInputNode } from "./createInputNode";
import { createOutputNode } from "./createOutputNode";
import { createTaskNode } from "./createTaskNode";

const createNodesFromComponentSpec = (
  componentSpec: ComponentSpec,
  nodeData: TaskNodeData,
  readOnly: boolean = false,
): Node[] => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return [];
  }

  const graphSpec = componentSpec.implementation.graph;
  const taskNodes = createTaskNodes(graphSpec, nodeData, readOnly);
  const inputNodes = createInputNodes(componentSpec, nodeData, readOnly);
  const outputNodes = createOutputNodes(componentSpec, nodeData, readOnly);

  return [...taskNodes, ...inputNodes, ...outputNodes];
};

const createTaskNodes = (
  graphSpec: GraphSpec,
  nodeData: TaskNodeData,
  readOnly: boolean,
) => {
  return Object.entries(graphSpec.tasks).map((task) =>
    createTaskNode(task, nodeData, readOnly),
  );
};

const createInputNodes = (
  componentSpec: ComponentSpec,
  nodeData: TaskNodeData,
  readOnly: boolean,
) => {
  return (componentSpec.inputs ?? []).map((inputSpec) =>
    createInputNode(inputSpec, nodeData, readOnly),
  );
};

const createOutputNodes = (
  componentSpec: ComponentSpec,
  nodeData: TaskNodeData,
  readOnly: boolean,
) => {
  return (componentSpec.outputs ?? []).map((outputSpec) =>
    createOutputNode(outputSpec, nodeData, readOnly),
  );
};

export default createNodesFromComponentSpec;
