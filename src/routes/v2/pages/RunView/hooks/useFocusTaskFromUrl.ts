import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Reads `?nodeId=` from the URL on mount, treats the value as a task name,
 * resolves it to the task's `$id`, then selects and fits that node into view.
 * The param is removed from the URL after the node is focused.
 */
export function useFocusTaskFromUrl(spec: ComponentSpec | null): void {
  const { editor } = useSharedStores();

  const linkedTaskName = new URLSearchParams(window.location.search).get(
    "nodeId",
  );

  useEffect(() => {
    if (!linkedTaskName || !spec) return;

    const task = spec.tasks.find((t) => t.name === linkedTaskName);
    if (!task) return;

    const nodeId = task.$id;
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      const url = new URL(window.location.href);
      url.searchParams.delete("nodeId");
      history.replaceState(null, "", url.toString());
    };

    const focus = () => {
      editor.selectNode(nodeId, "task");
      editor.setPendingFocusNode(nodeId);
      cleanup();
    };

    const frameId = requestAnimationFrame(() => requestAnimationFrame(focus));

    return () => {
      cancelAnimationFrame(frameId);
      cleanup();
    };
  }, [linkedTaskName, spec, editor]);
}
