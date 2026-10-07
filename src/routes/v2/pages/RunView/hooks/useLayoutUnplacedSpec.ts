import { useNodesInitialized } from "@xyflow/react";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { hasPlacedEntities } from "@/routes/v2/shared/nodes/buildUtils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Lays out a run whose pipeline carries no positions — authored as YAML, say —
 * which the canvas would otherwise pile up on index-based defaults. Waits for
 * the first measure pass because dagre needs React Flow's measured sizes.
 */
export function useLayoutUnplacedSpec(spec: ComponentSpec | null): void {
  const { keyboard } = useSharedStores();
  const nodesInitialized = useNodesInitialized();
  const laidOut = useRef<ComponentSpec | null>(null);

  useEffect(() => {
    if (!spec || !nodesInitialized) return;
    if (laidOut.current === spec) return;
    if (hasPlacedEntities(spec)) return;

    laidOut.current = spec;
    keyboard.invokeShortcut("auto-layout");
  }, [spec, nodesInitialized, keyboard]);
}
