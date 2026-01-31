import { type Node } from "@xyflow/react";

import { createFlexNode } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import type { TaskNodeData } from "@/types/taskNode";
import {
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";

import { FLEX_NODES_ANNOTATION } from "../annotations";
import { createInputNode } from "./createInputNode";
import { createOutputNode } from "./createOutputNode";
import { createTaskNode } from "./createTaskNode";

const createNodesFromComponentSpec = (
  componentSpec: ComponentSpec,
  nodeData: TaskNodeData,
): Node[] => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return [];
  }

  const graphSpec = componentSpec.implementation.graph;
  const taskNodes = createTaskNodes(graphSpec, nodeData);
  const inputNodes = createInputNodes(componentSpec, nodeData);
  const outputNodes = createOutputNodes(componentSpec, nodeData);
  const flexNodes = createFlexNodes(componentSpec);

  return [...taskNodes, ...inputNodes, ...outputNodes, ...flexNodes];
};

const createTaskNodes = (graphSpec: GraphSpec, nodeData: TaskNodeData) => {
  return Object.entries(graphSpec.tasks).map((task) =>
    createTaskNode(task, nodeData),
  );
};

const createInputNodes = (
  componentSpec: ComponentSpec,
  nodeData: TaskNodeData,
) => {
  return (componentSpec.inputs ?? []).map((inputSpec) =>
    createInputNode(inputSpec, nodeData),
  );
};

const createOutputNodes = (
  componentSpec: ComponentSpec,
  nodeData: TaskNodeData,
) => {
  return (componentSpec.outputs ?? []).map((outputSpec) =>
    createOutputNode(outputSpec, nodeData),
  );
};

const createFlexNodes = (componentSpec: ComponentSpec) => {
  return Object.entries(
    componentSpec.metadata?.annotations?.[FLEX_NODES_ANNOTATION] ?? [],
  ).map((flexNode) => createFlexNode(flexNode));
};

export default createNodesFromComponentSpec;
