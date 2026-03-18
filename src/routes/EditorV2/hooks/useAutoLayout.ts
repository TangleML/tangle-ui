import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";

import {
  autoLayoutNodes,
  type LayoutAlgorithm,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import type { ComponentSpec } from "@/models/componentSpec";
import { CMDALT, SHIFT } from "@/routes/EditorV2/shortcuts/keys";
import { applyAutoLayoutPositions } from "@/routes/EditorV2/store/actions";
import { registerShortcut } from "@/routes/EditorV2/store/keyboardStore";

/**
 * Registers Cmd+Shift+L keyboard shortcut for auto-layout.
 * Computes dagre layout for all nodes and applies positions to the spec.
 * Must be called inside ReactFlowProvider and SpecProvider.
 *
 * The shortcut action accepts an optional `{ algorithm }` param so it can
 * be invoked programmatically via `invokeShortcut("auto-layout", { algorithm })`.
 */
export function useAutoLayout(spec: ComponentSpec | null): void {
  const { getNodes, getEdges, fitView } = useReactFlow();

  const handleAutoLayout = (algorithm?: LayoutAlgorithm) => {
    if (!spec) return;

    const nodes = getNodes();
    const edges = getEdges();
    if (nodes.length === 0) return;

    const layoutedNodes = autoLayoutNodes(nodes, edges, algorithm);
    applyAutoLayoutPositions(spec, layoutedNodes);

    requestAnimationFrame(() => {
      fitView({ maxZoom: 1, duration: 300 });
    });
  };

  useEffect(() => {
    const unregister = registerShortcut({
      id: "auto-layout",
      keys: [CMDALT, SHIFT, "L"],
      label: "Auto layout",
      action: (_event, params) => {
        handleAutoLayout(params?.algorithm as LayoutAlgorithm | undefined);
      },
    });

    return unregister;
  }, [handleAutoLayout]);
}
