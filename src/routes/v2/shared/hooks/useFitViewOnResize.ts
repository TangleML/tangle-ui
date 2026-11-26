import { useReactFlow, useStoreApi } from "@xyflow/react";
import { reaction } from "mobx";
import { type RefObject, useEffect } from "react";

import { FLOW_CANVAS_DEFAULT_PROPS } from "@/routes/v2/shared/flowCanvasDefaults";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const VIEWPORT_CLAIMING_EVENTS = ["pointerdown", "wheel", "keydown"] as const;

/**
 * The `fitView` prop frames the graph once, against whatever size the canvas
 * had at that moment — routinely before the embedded dock collapses or a
 * background workarea tab is shown, which leaves the graph small and off to one
 * side. Reframe on every resize until the user or a node focus takes over.
 */
export function useFitViewOnResize(
  containerRef: RefObject<HTMLElement | null>,
): void {
  const { editor } = useSharedStores();
  const { fitView } = useReactFlow();
  const store = useStoreApi();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let viewportClaimed = false;
    const claimViewport = () => {
      viewportClaimed = true;
    };

    const unsubscribe = store.subscribe(({ width, height }, previous) => {
      if (viewportClaimed) return;
      if (width === previous.width && height === previous.height) return;
      if (!width || !height) return;
      void fitView(FLOW_CANVAS_DEFAULT_PROPS.fitViewOptions);
    });

    const disposeFocusReaction = reaction(
      () => editor.pendingFocusNodeId,
      (nodeId) => {
        if (nodeId) claimViewport();
      },
      { fireImmediately: true },
    );

    for (const type of VIEWPORT_CLAIMING_EVENTS) {
      container.addEventListener(type, claimViewport, { capture: true });
    }

    return () => {
      unsubscribe();
      disposeFocusReaction();
      for (const type of VIEWPORT_CLAIMING_EVENTS) {
        container.removeEventListener(type, claimViewport, { capture: true });
      }
    };
  }, [containerRef, editor, fitView, store]);
}
