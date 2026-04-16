import type { Edge, Node } from "@xyflow/react";
import { autorun, computed } from "mobx";
import { useEffect, useState } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";

const EMPTY_RESULT: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

export function useSpecToNodesEdges(spec: ComponentSpec | null) {
  const registry = useNodeRegistry();
  const [result, setResult] = useState(EMPTY_RESULT);

  useEffect(() => {
    if (!spec) {
      setResult(EMPTY_RESULT);
      return;
    }

    const derivation = computed(() => ({
      nodes: registry.buildAllNodes(spec),
      edges: registry.buildAllEdges(spec),
    }));

    return autorun(() => {
      setResult(derivation.get());
    });
  }, [spec, registry]);

  return result;
}
