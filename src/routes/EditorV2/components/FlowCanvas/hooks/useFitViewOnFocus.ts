import type { ReactFlowInstance } from "@xyflow/react";
import { useEffect } from "react";

import { editorStore, setPendingFocusNode } from "../../../store/editorStore";

export function useFitViewOnFocus(
  reactFlowInstance: ReactFlowInstance | null,
): void {
  const pendingFocusNodeId = editorStore.pendingFocusNodeId;

  useEffect(() => {
    if (!pendingFocusNodeId || !reactFlowInstance) return;

    const timer = setTimeout(async () => {
      await reactFlowInstance.fitView({
        nodes: [{ id: pendingFocusNodeId }],
        maxZoom: 1,
        duration: 300,
      });
      setPendingFocusNode(null);
    }, 50);

    return () => clearTimeout(timer);
  }, [pendingFocusNodeId, reactFlowInstance]);
}
