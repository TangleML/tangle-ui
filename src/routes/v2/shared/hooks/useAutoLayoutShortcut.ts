import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";

import {
  autoLayoutNodes,
  getMeasuredNodeSize,
  type LayoutAlgorithm,
  type NodeSize,
  type NodeSizeResolver,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import type { ComponentSpec } from "@/models/componentSpec";
import { isDetailedZoom } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { estimateFullCardSize } from "@/routes/v2/shared/nodes/estimateFullCardSize";
import { CMD_OR_CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const largerOf = (a: NodeSize, b: NodeSize): NodeSize => ({
  width: Math.max(a.width, b.width),
  height: Math.max(a.height, b.height),
});

/**
 * Registers the Cmd+Shift+L auto-layout shortcut.
 * Computes dagre layout and delegates position application to `applyLayout`.
 * Must be called inside a ReactFlowProvider.
 *
 * Zoomed out, nodes render as placeholders whose measured size says nothing
 * about the full card, and which grow past it as zoom approaches the minimum.
 * Layout reserves room for whichever is larger in each dimension: the
 * placeholder or the full card estimated from the spec.
 */
export function useAutoLayoutShortcut(
  applyLayout: (layoutedNodes: Node[]) => void,
  spec: ComponentSpec | null,
): void {
  const { getNodes, getEdges, getZoom, fitView } = useReactFlow();
  const { keyboard, editor } = useSharedStores();

  useEffect(() => {
    const resolveNodeSize = (): NodeSizeResolver => {
      if (!spec || isDetailedZoom(getZoom())) return getMeasuredNodeSize;
      return (node) => {
        const measured = getMeasuredNodeSize(node);
        const estimate = estimateFullCardSize(node, spec);
        return estimate ? largerOf(estimate, measured) : measured;
      };
    };

    const handleAutoLayout = (
      algorithm?: LayoutAlgorithm,
      onLaidOut?: () => void,
    ) => {
      const nodes = getNodes();
      const edges = getEdges();
      if (nodes.length === 0) return;

      const layoutedNodes = autoLayoutNodes(
        nodes,
        edges,
        algorithm,
        resolveNodeSize(),
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
    getZoom,
    fitView,
    applyLayout,
    keyboard,
    editor,
    spec,
  ]);
}
