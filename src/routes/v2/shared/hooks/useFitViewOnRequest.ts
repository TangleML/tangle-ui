import { useReactFlow, useStoreApi } from "@xyflow/react";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

// One tool call can open several undo groups, so requests are coalesced. Short
// enough that each call still reads as its own step.
const SETTLE_MS = 250;

/**
 * Frames the graph when something outside the canvas rebuilds it — today, an
 * agent editing the pipeline the user is watching. Without this the agent's
 * work lands wherever the graph grew, which is routinely off screen.
 */
export function useFitViewOnRequest(): void {
  const { editor } = useSharedStores();
  const { fitView } = useReactFlow();
  const store = useStoreApi();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dispose = reaction(
      () => editor.fitViewRequestCount,
      (count) => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        if (count === 0) return;

        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          // An inactive workarea tab stays mounted with no size, and fitting
          // against nothing leaves it on a viewport the user never chose.
          const { width, height } = store.getState();
          if (!width || !height) return;
          void fitView({ maxZoom: 1, duration: 300 });
        }, SETTLE_MS);
      },
    );

    return () => {
      dispose();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editor, fitView, store]);
}
