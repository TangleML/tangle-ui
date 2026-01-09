import { useEdges } from "@xyflow/react";

export function useEdgeSelectionHighlight(nodeId: string) {
  const edges = useEdges();

  const selectedEdges = edges.filter((edge) => edge.selected);
  const isConnectedToSelectedEdge =
    selectedEdges.length > 0 &&
    selectedEdges.some(
      (edge) => edge.source === nodeId || edge.target === nodeId,
    );

  return isConnectedToSelectedEdge;
}
