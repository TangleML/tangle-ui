import { type Edge, type EdgeChange, useStoreApi } from "@xyflow/react";

export function useHandleEdgeSelection(nodeId: string) {
  const store = useStoreApi();

  // Only `select` changes, and only for edges whose selection flips. Replacing
  // the edges instead would hand the canvas React Flow's display copies, overlay
  // styles included, to keep as its own edge state.
  const setSelected = (isSelected: (edge: Edge) => boolean) => {
    const { edges, triggerEdgeChanges } = store.getState();
    const changes: EdgeChange[] = [];
    for (const edge of edges) {
      const selected = isSelected(edge);
      if (Boolean(edge.selected) !== selected) {
        changes.push({ id: edge.id, type: "select", selected });
      }
    }
    triggerEdgeChanges(changes);
  };

  const selectEdgesForHandle = (
    handleId: string | readonly string[],
    handleType?: "source" | "target",
  ) => {
    const handleIds = typeof handleId === "string" ? [handleId] : handleId;
    setSelected(
      (edge) =>
        (handleType !== "target" &&
          edge.source === nodeId &&
          handleIds.includes(edge.sourceHandle ?? "")) ||
        (handleType !== "source" &&
          edge.target === nodeId &&
          handleIds.includes(edge.targetHandle ?? "")),
    );
  };

  const clearEdgeSelection = () => {
    setSelected(() => false);
  };

  return { selectEdgesForHandle, clearEdgeSelection };
}
