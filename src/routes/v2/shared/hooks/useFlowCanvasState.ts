import type {
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowProps,
} from "@xyflow/react";
import { useEdgesState, useNodesState } from "@xyflow/react";
import type { MouseEvent } from "react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

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
  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  const [nodes, setNodes, rfOnNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState(specEdges);

  const {
    nodes: displayNodes,
    edges: displayEdges,
    onEdgeClick,
  } = useCanvasEnhancements({
    spec,
    nodes,
    edges,
    metaKeyPressed,
    isConnecting,
  });

  useEffect(() => {
    setNodes(specNodes);
    setEdges(specEdges);
  }, [specNodes, specEdges, setNodes, setEdges]);

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
