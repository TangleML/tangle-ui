import { useReactFlow } from "@xyflow/react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Returns a function that clears all selection state: the editor store and
 * ReactFlow's internal node/edge `selected` flags.
 */
export function useDeselectAll(): () => void {
  const { editor } = useSharedStores();
  const reactFlow = useReactFlow();

  return () => {
    editor.clearSelection();
    reactFlow.setNodes((ns) =>
      ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
    );
    reactFlow.setEdges((es) =>
      es.map((e) => (e.selected ? { ...e, selected: false } : e)),
    );
  };
}
