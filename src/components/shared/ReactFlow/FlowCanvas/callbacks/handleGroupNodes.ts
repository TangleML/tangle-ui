import type { Node } from "@xyflow/react";
import type { ReactNode } from "react";

import type { TriggerInputDialogProps } from "@/hooks/useInputDialog";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { createSubgraphFromNodes } from "@/utils/nodes/createSubgraphFromNodes";
import { getUniqueTaskName, validateTaskName } from "@/utils/unique";

import addTask from "../utils/addTask";
import { calculateNodesCenter } from "../utils/geometry";
import { removeNode } from "../utils/removeNode";
import { updateDownstreamSubgraphConnections } from "../utils/updateDownstreamSubgraphConnections";

export const handleGroupNodes = async (
  selectedNodes: Node[],
  currentSubgraphSpec: ComponentSpec,
  inputDialogContent: ReactNode,
  triggerInputDialog: (
    props: TriggerInputDialogProps,
  ) => Promise<string | null>,
  onSuccess: (updatedComponentSpec: ComponentSpec) => void,
  onError: (error: Error) => void,
) => {
  if (!isGraphImplementation(currentSubgraphSpec.implementation)) return;

  const currentSubgraphGraphSpec = currentSubgraphSpec.implementation.graph;

  try {
    const defaultName = getUniqueTaskName(
      currentSubgraphGraphSpec,
      "New Subgraph",
    );

    const name = await triggerInputDialog({
      title: "Create Subgraph",
      description: "Enter subgraph name",
      defaultValue: defaultName,
      content: inputDialogContent,
      validate: (value: string) =>
        validateTaskName(value, currentSubgraphGraphSpec, true),
    });

    if (!name) return;

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
