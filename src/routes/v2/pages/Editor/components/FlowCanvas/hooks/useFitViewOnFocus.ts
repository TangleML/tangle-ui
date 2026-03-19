import { useReactFlow } from "@xyflow/react";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Uses a MobX reaction instead of render-time observable read + useEffect
 * so that fitView fires reliably even when navigateToPath triggers
 * intermediate clearSelection reactions before setPendingFocusNode is called.
 */
export function useFitViewOnFocus(): void {
  const { editor } = useSharedStores();
  const { fitView } = useReactFlow();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dispose = reaction(
      () => editor.pendingFocusNodeId,
      (nodeId) => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        if (!nodeId) return;

        timerRef.current = setTimeout(async () => {
          timerRef.current = null;
          await fitView({
            nodes: [{ id: nodeId }],
            maxZoom: 1,
            duration: 300,
          });
          editor.setPendingFocusNode(null);
        }, 50);
      },
    );

    return () => {
      dispose();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [fitView, editor]);
}
