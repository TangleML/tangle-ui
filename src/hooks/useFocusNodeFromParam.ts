import type { ReactFlowInstance } from "@xyflow/react";
import { useEffect, useRef } from "react";

import {
  FIT_VIEW_ANIMATION_DURATION,
  FIT_VIEW_MAX_ZOOM,
} from "@/components/shared/ReactFlow/constants";
import { taskIdToNodeId } from "@/utils/nodes/nodeIdUtils";

import { useFocusNodeParam } from "./useFocusNodeParam";

/**
 * Focuses a node on initial page load based on the `focus` query param.
 * Selects the node and pans the viewport to center it.
 *
 * @param reactFlowInstance - The ReactFlow instance for node manipulation
 * @param hasNodes - Whether the canvas has rendered nodes (use `nodes.length > 0`)
 */
export const useFocusNodeFromParam = (
  reactFlowInstance: ReactFlowInstance | undefined,
  hasNodes: boolean,
) => {
  const { focusNodeId: focusTaskId, clearFocusNode } = useFocusNodeParam();
  const hasAppliedFocus = useRef(false);

  useEffect(() => {
    if (hasAppliedFocus.current) return;
    if (!hasNodes || !reactFlowInstance || !focusTaskId) return;

    const targetNodeId = taskIdToNodeId(focusTaskId);
    const node = reactFlowInstance.getNode(targetNodeId);
    if (!node) return;

    hasAppliedFocus.current = true;

    reactFlowInstance.setNodes((nds) =>
      nds.map((n) => ({ ...n, selected: n.id === targetNodeId })),
    );

    requestAnimationFrame(() => {
      reactFlowInstance.fitView({
        nodes: [node],
        maxZoom: FIT_VIEW_MAX_ZOOM,
        duration: FIT_VIEW_ANIMATION_DURATION,
      });
    });
  }, [focusTaskId, reactFlowInstance, hasNodes]);

  return { clearFocusNode };
};
