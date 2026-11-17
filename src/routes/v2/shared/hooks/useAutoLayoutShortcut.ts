import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";

import {
  autoLayoutNodes,
  getMeasuredNodeSize,
  type LayoutAlgorithm,
  type NodeSizeResolver,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import type { ComponentSpec } from "@/models/componentSpec";
import { isDetailedZoom } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { estimateFullCardSize } from "@/routes/v2/shared/nodes/estimateFullCardSize";
import { CMD_OR_CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Registers the Cmd+Shift+L auto-layout shortcut.
 * Computes dagre layout and delegates position application to `applyLayout`.
 * Must be called inside a ReactFlowProvider.
 *
 * Zoomed out, nodes render as placeholders whose measured size says nothing
 * about the full card, so layout sizes the nodes from the spec instead.
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
      return (node) =>
        estimateFullCardSize(node, spec) ?? getMeasuredNodeSize(node);
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
