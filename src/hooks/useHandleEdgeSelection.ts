import { useEdges, useReactFlow } from "@xyflow/react";

export function useHandleEdgeSelection(nodeId: string) {
  const edges = useEdges();
  const { setEdges } = useReactFlow();

  const selectEdgesForHandle = (
    handleId: string,
    handleType: "source" | "target",
  ) => {
    const connectedEdgeIds = new Set<string>();

    for (const edge of edges) {
      const isMatch =
        handleType === "source"
          ? edge.source === nodeId && edge.sourceHandle === handleId
          : edge.target === nodeId && edge.targetHandle === handleId;

      if (isMatch) connectedEdgeIds.add(edge.id);
    }

    if (connectedEdgeIds.size === 0) return;

    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selected: connectedEdgeIds.has(edge.id),
      })),
    );
  };

  const clearEdgeSelection = () => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selected: false,
      })),
    );
  };

  return { selectEdgesForHandle, clearEdgeSelection };
}
