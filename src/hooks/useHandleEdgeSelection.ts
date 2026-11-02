import { useReactFlow } from "@xyflow/react";

export function useHandleEdgeSelection(nodeId: string) {
  const { setEdges } = useReactFlow();

  const selectEdgesForHandle = (
    handleId: string,
    handleType?: "source" | "target",
  ) => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selected:
          (handleType !== "target" &&
            edge.source === nodeId &&
            edge.sourceHandle === handleId) ||
          (handleType !== "source" &&
            edge.target === nodeId &&
            edge.targetHandle === handleId),
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
