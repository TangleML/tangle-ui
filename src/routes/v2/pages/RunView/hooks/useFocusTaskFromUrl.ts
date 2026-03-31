import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { NodeEntityType } from "@/routes/v2/shared/store/editorStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Resolves a node name to its entity ID and type by searching tasks,
 * inputs, and outputs in that order.
 */
function resolveNode(
  spec: ComponentSpec,
  name: string,
): { nodeId: string; nodeType: NodeEntityType } | null {
  const task = spec.tasks.find((t) => t.name === name);
  if (task) return { nodeId: task.$id, nodeType: "task" };

  const input = spec.inputs.find((i) => i.name === name);
  if (input) return { nodeId: input.$id, nodeType: "input" };

  const output = spec.outputs.find((o) => o.name === name);
  if (output) return { nodeId: output.$id, nodeType: "output" };

  return null;
}

/**
 * Reads `?nodeId=` from the URL on mount, treats the value as a node name
 * (task, input, or output), resolves it to the entity's `$id`, then selects
 * and fits that node into view. The param is removed from the URL afterwards.
 */
export function useFocusTaskFromUrl(spec: ComponentSpec | null): void {
  const { editor } = useSharedStores();

  const linkedNodeName = new URLSearchParams(window.location.search).get(
    "nodeId",
  );

  useEffect(() => {
    if (!linkedNodeName || !spec) return;

    const resolved = resolveNode(spec, linkedNodeName);
    if (!resolved) return;

    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      const url = new URL(window.location.href);
      url.searchParams.delete("nodeId");
      history.replaceState(null, "", url.toString());
    };

    const focus = () => {
      editor.selectNode(resolved.nodeId, resolved.nodeType);
      editor.setPendingFocusNode(resolved.nodeId);
      cleanup();
    };

    const frameId = requestAnimationFrame(() => requestAnimationFrame(focus));

    return () => {
      cancelAnimationFrame(frameId);
      cleanup();
    };
  }, [linkedNodeName, spec, editor]);
}
