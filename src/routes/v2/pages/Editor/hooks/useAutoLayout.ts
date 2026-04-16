import type { Node } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useAutoLayoutShortcut } from "@/routes/v2/shared/hooks/useAutoLayoutShortcut";

/**
 * Registers Cmd+Shift+L keyboard shortcut for auto-layout.
 * Computes dagre layout for all nodes and applies positions to the spec.
 * Must be called inside ReactFlowProvider and SpecProvider.
 *
 * The shortcut action accepts an optional `{ algorithm }` param so it can
 * be invoked programmatically via `invokeShortcut("auto-layout", { algorithm })`.
 */
export function useAutoLayout(spec: ComponentSpec | null): void {
  const { applyAutoLayoutPositions } = useTaskActions();

  const applyLayout = (layoutedNodes: Node[]) => {
    if (!spec) return;
    applyAutoLayoutPositions(spec, layoutedNodes);
  };

  useAutoLayoutShortcut(applyLayout);
}
