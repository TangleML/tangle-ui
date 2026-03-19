import { useReactFlow } from "@xyflow/react";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import {
  editorStore,
  setPendingFocusNode,
} from "@/routes/v2/shared/store/editorStore";

/**
 * Uses a MobX reaction instead of render-time observable read + useEffect
 * so that fitView fires reliably even when navigateToPath triggers
 * intermediate clearSelection reactions before setPendingFocusNode is called.
 */
export function useFitViewOnFocus(): void {
  const { fitView } = useReactFlow();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dispose = reaction(
      () => editorStore.pendingFocusNodeId,
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
          setPendingFocusNode(null);
        }, 50);
      },
    );

    return () => {
      dispose();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [fitView]);
}
