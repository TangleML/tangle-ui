import { useEffect } from "react";

import { useNodesOverlay } from "@/components/shared/ReactFlow/NodesOverlay/NodesOverlayProvider";

/**
 * Reads `?nodeId=` from the URL on mount, fits that node into view, selects it,
 * and highlights it with an orange border. The highlight clears (and the param
 * is removed from the URL) on the next user pointer or keyboard interaction.
 */
export const useFitNodeFromUrl = () => {
  const { fitNodeIntoView, selectNode, notifyNode } = useNodesOverlay();

  const linkedNodeId = new URLSearchParams(window.location.search).get(
    "nodeId",
  );

  useEffect(() => {
    if (!linkedNodeId) return;

    const nodeId = linkedNodeId;
    let timeoutId: ReturnType<typeof setTimeout>;
    let isHighlighted = false;

    const clearHighlight = () => {
      if (!isHighlighted) return;

      isHighlighted = false;

      notifyNode(nodeId, { type: "clear" });

      const url = new URL(window.location.href);
      url.searchParams.delete("nodeId");

      history.replaceState(null, "", url.toString());
      document.removeEventListener("pointerdown", clearHighlight);
      document.removeEventListener("keydown", clearHighlight);
    };

    const focus = async () => {
      const success = await fitNodeIntoView(nodeId);
      if (!success) return;

      isHighlighted = true;

      selectNode(nodeId);
      notifyNode(nodeId, { type: "highlight" });

      timeoutId = setTimeout(() => {
        document.addEventListener("pointerdown", clearHighlight);
        document.addEventListener("keydown", clearHighlight);
      }, 500);
    };

    // Double-RAF to allow the canvas to render nodes before querying them
    const frameId = requestAnimationFrame(() => requestAnimationFrame(focus));

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      clearHighlight();
    };
  }, []);

  return { linkedNodeId };
};
