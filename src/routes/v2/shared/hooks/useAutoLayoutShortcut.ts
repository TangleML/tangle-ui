import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";

import {
  autoLayoutNodes,
  type LayoutAlgorithm,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { CMDALT, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Registers the Cmd+Shift+L auto-layout shortcut.
 * Computes dagre layout and delegates position application to `applyLayout`.
 * Must be called inside a ReactFlowProvider.
 */
export function useAutoLayoutShortcut(
  applyLayout: (layoutedNodes: Node[]) => void,
): void {
  const { getNodes, getEdges, fitView } = useReactFlow();
  const { keyboard } = useSharedStores();

  useEffect(() => {
    const handleAutoLayout = (algorithm?: LayoutAlgorithm) => {
      const nodes = getNodes();
      const edges = getEdges();
      if (nodes.length === 0) return;

      const layoutedNodes = autoLayoutNodes(nodes, edges, algorithm);
      applyLayout(layoutedNodes);

      requestAnimationFrame(() => {
        fitView({ maxZoom: 1, duration: 300 });
      });
    };

    const unregister = keyboard.registerShortcut({
      id: "auto-layout",
      keys: [CMDALT, SHIFT, "L"],
      label: "Auto layout",
      action: (_event, params) => {
        handleAutoLayout(params?.algorithm as LayoutAlgorithm | undefined);
      },
    });

    return unregister;
  }, [getNodes, getEdges, fitView, applyLayout, keyboard]);
}
