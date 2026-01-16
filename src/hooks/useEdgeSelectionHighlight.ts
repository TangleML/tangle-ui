import { useEdges, useNodes } from "@xyflow/react";

export function useEdgeSelectionHighlight(nodeId: string) {
  const edges = useEdges();
  const nodes = useNodes();

  const selectedNodes = nodes.filter((node) => node.selected);

  // Disable edge highlighting when multiple nodes are selected (multi-select scenario)
  // to avoid highlighting nodes outside the selection
  if (selectedNodes.length > 1) {
    return false;
  }

  const selectedEdges = edges.filter((edge) => edge.selected);
  const hasAnySelectedEdge = selectedEdges.length > 0;
  const isConnectedToSelectedEdge =
    hasAnySelectedEdge &&
    selectedEdges.some(
      (edge) => edge.source === nodeId || edge.target === nodeId,
    );

  return { isConnectedToSelectedEdge, hasAnySelectedEdge };
}
