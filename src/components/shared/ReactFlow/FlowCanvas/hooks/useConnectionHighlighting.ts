import { useEdges } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";

import {
  clearHighlights,
  getSelectedHandle,
  highlightConnections,
  subscribeToHandleHighlights,
} from "@/utils/nodes/highlightingState";

export const useConnectionHighlighting = () => {
  const [, forceUpdate] = useState({});
  const edges = useEdges();

  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  useEffect(() => {
    return subscribeToHandleHighlights(triggerUpdate);
  }, [triggerUpdate]);

  const isHandleHighlighted = useCallback(
    (nodeId: string, handleId: string) => {
      const globalSelectedHandle = getSelectedHandle();
      if (!globalSelectedHandle) return false;

      if (
        nodeId === globalSelectedHandle.nodeId &&
        handleId === globalSelectedHandle.handleId
      ) {
        return true;
      }

      return edges.some((edge) => {
        if (globalSelectedHandle.handleType === "input") {
          return (
            edge.target === globalSelectedHandle.nodeId &&
            edge.targetHandle === globalSelectedHandle.handleId &&
            edge.source === nodeId &&
            edge.sourceHandle === handleId
          );
        } else {
          return (
            edge.source === globalSelectedHandle.nodeId &&
            edge.sourceHandle === globalSelectedHandle.handleId &&
            edge.target === nodeId &&
            edge.targetHandle === handleId
          );
        }
      });
    },
    [edges],
  );

  return {
    highlightConnections,
    clearHighlights,
    isHandleHighlighted,
  };
};
