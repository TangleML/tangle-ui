import type { Node } from "@xyflow/react";

import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { createSubgraphFromNodes } from "@/utils/nodes/createSubgraphFromNodes";

import addTask from "../../utils/addTask";
import { calculateNodesCenter } from "../../utils/geometry";
import { removeNode } from "../../utils/removeNode";
import { updateDownstreamSubgraphConnections } from "../../utils/updateDownstreamSubgraphConnections";

export const handleGroupNodes = async (
  selectedNodes: Node[],
  currentSubgraphSpec: ComponentSpec,
  name: string,
  onSuccess: (updatedComponentSpec: ComponentSpec) => void,
  onError: (error: Error) => void,
) => {
  if (!isGraphImplementation(currentSubgraphSpec.implementation)) return;

  try {
    const { subgraphTask: subgraphTaskSpec, connectionMappings } =
      await createSubgraphFromNodes(selectedNodes, currentSubgraphSpec, name);

    const position = calculateNodesCenter(selectedNodes);
    const { spec: currentSubgraphSpecWithNewTask, taskId: subgraphTaskId } =
      addTask("task", subgraphTaskSpec, position, currentSubgraphSpec);

    if (!subgraphTaskId) {
      onError(new Error("Subgraph Task ID is undefined."));
      return;
    }

    const actualMappings = connectionMappings.map((mapping) => ({
      ...mapping,
      newTaskId: subgraphTaskId,
    }));

    const updatedSubgraphSpec = updateDownstreamSubgraphConnections(
      currentSubgraphSpecWithNewTask,
      actualMappings,
    );

    let finalSubgraphSpec = updatedSubgraphSpec;

    selectedNodes.forEach((node) => {
      finalSubgraphSpec = removeNode(node, finalSubgraphSpec);
    });

    onSuccess(finalSubgraphSpec);
  } catch (error) {
    onError(error as Error);
  }
};
