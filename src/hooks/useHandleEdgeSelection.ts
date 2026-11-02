import { useReactFlow } from "@xyflow/react";

export function useHandleEdgeSelection(nodeId: string) {
  const { setEdges } = useReactFlow();

  const selectEdgesForHandle = (
    handleId: string | readonly string[],
    handleType?: "source" | "target",
  ) => {
    const handleIds = typeof handleId === "string" ? [handleId] : handleId;
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selected:
          (handleType !== "target" &&
            edge.source === nodeId &&
            handleIds.includes(edge.sourceHandle ?? "")) ||
          (handleType !== "source" &&
            edge.target === nodeId &&
            handleIds.includes(edge.targetHandle ?? "")),
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
