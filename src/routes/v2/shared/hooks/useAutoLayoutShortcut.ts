import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";

import {
  autoLayoutNodes,
  buildHandleBoundsMap,
  type LayoutAlgorithm,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { CMD_OR_CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Registers the Cmd+Shift+L auto-layout shortcut.
 * Defaults to the port-aware `pipeline_grid` layout (keeps connected input/output
 * handles aligned on the snap grid); the View menu can invoke other algorithms
 * explicitly. Delegates position application to `applyLayout`.
 * Must be called inside a ReactFlowProvider.
 */
export function useAutoLayoutShortcut(
  applyLayout: (layoutedNodes: Node[]) => void,
): void {
  const { getNodes, getEdges, getInternalNode, fitView } = useReactFlow();
  const { keyboard, editor } = useSharedStores();

  useEffect(() => {
    const handleAutoLayout = (
      algorithm?: LayoutAlgorithm,
      onLaidOut?: () => void,
    ) => {
      const nodes = getNodes();
      const edges = getEdges();
      if (nodes.length === 0) return;

      const handleBounds = buildHandleBoundsMap(
        nodes.map((node) => node.id),
        getInternalNode,
      );
      const layoutedNodes = autoLayoutNodes(
        nodes,
        edges,
        algorithm,
        handleBounds,
      );
      applyLayout(layoutedNodes);
      onLaidOut?.();

      requestAnimationFrame(() => {
        if (editor.pendingFocusNodeId) return;
        fitView({ maxZoom: 1, duration: 300 });
      });
    };

    const unregister = keyboard.registerShortcut({
      id: "auto-layout",
      keys: [CMD_OR_CTRL, SHIFT, "L"],
      label: "Auto layout",
      action: (_event, params) => {
        handleAutoLayout(
          params?.algorithm as LayoutAlgorithm | undefined,
          params?.onLaidOut as (() => void) | undefined,
        );
      },
    });

    return unregister;
  }, [
    getNodes,
    getEdges,
    getInternalNode,
    fitView,
    applyLayout,
    keyboard,
    editor,
  ]);
}
