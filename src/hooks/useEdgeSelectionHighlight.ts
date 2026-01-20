import { useEdges } from "@xyflow/react";

export function useEdgeSelectionHighlight(nodeId: string) {
  const edges = useEdges();

  const selectedEdges = edges.filter((edge) => edge.selected);
  const hasAnySelectedEdge = selectedEdges.length > 0;
  const isConnectedToSelectedEdge =
    hasAnySelectedEdge &&
    selectedEdges.some(
      (edge) => edge.source === nodeId || edge.target === nodeId,
    );

  return { isConnectedToSelectedEdge, hasAnySelectedEdge };
}
