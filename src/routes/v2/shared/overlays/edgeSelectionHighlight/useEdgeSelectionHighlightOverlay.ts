import type { Edge, ReactFlowState } from "@xyflow/react";
import { useStore } from "@xyflow/react";

import { EdgeColor } from "@/components/shared/ReactFlow/FlowCanvas/Edges/utils";
import { useCanvasOverlay } from "@/routes/v2/shared/hooks/useCanvasOverlay";
import type {
  CanvasOverlayConfig,
  NodeOverlayEffect,
} from "@/routes/v2/shared/store/canvasOverlay.types";

const OVERLAY_ID = "edge-selection-highlight";

const HIGHLIGHT_EFFECT: NodeOverlayEffect = {
  className: "ring-4 ring-edge-selected/60 rounded-2xl",
};

const DIMMED_EFFECT: NodeOverlayEffect = {
  opacity: 0.3,
};

/**
 * Serialises the set of entity IDs connected to selected edges, plus any
 * selected nodes (so they keep the highlight effect rather than being
 * dimmed), into a stable comma-separated key. Returns `null` when no edge
 * is selected, so the overlay is deactivated.
 */
function selectConnectedKey(state: ReactFlowState): string | null {
  const selectedEdges = state.edges.filter((e: Edge) => e.selected);
  if (selectedEdges.length === 0) return null;

  const ids = new Set<string>();
  for (const edge of selectedEdges) {
    ids.add(edge.source);
    ids.add(edge.target);
  }
  for (const node of state.nodes) {
    if (node.selected) ids.add(node.id);
  }
  return [...ids].sort().join(",");
}

function buildConfig(connectedIds: ReadonlySet<string>): CanvasOverlayConfig {
  return {
    id: OVERLAY_ID,
    resolveNodeEffect: (nodeId: string) =>
      connectedIds.has(nodeId) ? HIGHLIGHT_EFFECT : DIMMED_EFFECT,
    resolveEdgeEffect: (edge: Edge) =>
      connectedIds.has(edge.source) && connectedIds.has(edge.target)
        ? {
            ...HIGHLIGHT_EFFECT,
            style: { stroke: EdgeColor.Selected },
          }
        : DIMMED_EFFECT,
  };
}

/**
 * Activates a canvas overlay that highlights nodes connected to any
 * selected edge. Deactivates automatically when no edge is selected.
 */
export function useEdgeSelectionHighlightOverlay(): void {
  const connectedKey = useStore(selectConnectedKey);

  const config: CanvasOverlayConfig | null = connectedKey
    ? buildConfig(new Set(connectedKey.split(",")))
    : null;

  useCanvasOverlay(config);
}
