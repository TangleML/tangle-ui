import type {
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowProps,
} from "@xyflow/react";
import { useEdgesState, useNodesState } from "@xyflow/react";
import type { MouseEvent } from "react";
import { useState } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useEdgeSelectionHighlightOverlay } from "@/routes/v2/shared/overlays/edgeSelectionHighlight/useEdgeSelectionHighlightOverlay";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { useCanvasEnhancements } from "./useCanvasEnhancements";
import { useSelectionBehavior } from "./useSelectionBehavior";
import { useSpecToNodesEdges } from "./useSpecToNodesEdges";

interface UseFlowCanvasStateParams {
  spec: ComponentSpec | null;
  metaKeyPressed?: boolean;
  isConnecting?: boolean;
}

interface UseFlowCanvasStateResult {
  displayNodes: Node[];
  displayEdges: Edge[];
  onEdgeClick: ((event: MouseEvent, edge: { id: string }) => void) | undefined;
  rfOnNodesChange: OnNodesChange;
  rfOnEdgesChange: OnEdgesChange;
  selectionBehavior: Required<Pick<ReactFlowProps, "onSelectionChange">>;
}

/**
 * Aggregates the common flow canvas state setup shared by Editor and RunView:
 * spec-to-nodes conversion, React Flow state, sync effect,
 * canvas enhancements, and selection behavior.
 */
export function useFlowCanvasState({
  spec,
  metaKeyPressed = false,
  isConnecting = false,
}: UseFlowCanvasStateParams): UseFlowCanvasStateResult {
  const registry = useNodeRegistry();
  const { canvasOverlay } = useSharedStores();
  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  const [nodes, setNodes, rfOnNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState(specEdges);

  const [syncedSpecNodes, setSyncedSpecNodes] = useState(specNodes);
  const [syncedSpecEdges, setSyncedSpecEdges] = useState(specEdges);

  if (syncedSpecNodes !== specNodes) {
    setSyncedSpecNodes(specNodes);
    setNodes(specNodes);
  }
  if (syncedSpecEdges !== specEdges) {
    setSyncedSpecEdges(specEdges);
    setEdges(specEdges);
  }

  const {
    nodes: displayNodes,
    edges: displayEdges,
    onEdgeClick,
  } = useCanvasEnhancements(
    registry,
    {
      spec,
      nodes,
      edges,
      metaKeyPressed,
      isConnecting,
    },
    canvasOverlay,
  );

  useEdgeSelectionHighlightOverlay();

  const selectionBehavior = useSelectionBehavior(spec);

  return {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    rfOnEdgesChange,
    selectionBehavior,
  };
}
