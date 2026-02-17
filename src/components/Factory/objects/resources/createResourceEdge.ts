import type { Edge, ReactFlowInstance } from "@xyflow/react";

import { RESOURCES } from "../../data/resources";
import type { ResourceType } from "../../types/resources";
import { extractResource } from "../../utils/string";

export const createResourceEdge = (
  sourceNodeId: string,
  targetNodeId: string,
  resource: ResourceType,
  reactFlowInstance: ReactFlowInstance,
  sourceHandleId?: string | null,
  targetHandleId?: string | null,
) => {
  const { getInternalNode } = reactFlowInstance;

  const sourceInternalNode = getInternalNode(sourceNodeId);
  const targetInternalNode = getInternalNode(targetNodeId);

  if (!sourceHandleId) {
    const sourceHandle =
      sourceInternalNode?.internals.handleBounds?.source?.find(
        (handle) =>
          extractResource(handle.id) === resource ||
          extractResource(handle.id) === "any",
      );
    if (sourceHandle?.id) {
      sourceHandleId = sourceHandle.id;
    }
  }

  if (!targetHandleId) {
    const targetHandle =
      targetInternalNode?.internals.handleBounds?.target?.find(
        (handle) =>
          extractResource(handle.id) === resource ||
          extractResource(handle.id) === "any",
      );

    if (targetHandle?.id) {
      targetHandleId = targetHandle.id;
    }
  }

  if (!sourceHandleId || !targetHandleId) {
    console.error(
      "Could not find valid handles for resource edge:",
      resource,
      sourceNodeId,
      targetNodeId,
    );
    return null;
  }

  const newEdge: Edge = {
    id: `${sourceNodeId}-${sourceHandleId}-${targetNodeId}-${targetHandleId}`,
    type: "resourceEdge",
    source: sourceNodeId,
    target: targetNodeId,
    sourceHandle: sourceHandleId,
    targetHandle: targetHandleId,
    data: { ...RESOURCES[resource], type: resource },
    animated: true,
  };

  return newEdge;
};
