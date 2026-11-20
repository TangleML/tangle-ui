import type { Edge, Node } from "@xyflow/react";
import { autorun, computed } from "mobx";
import { useEffect, useState } from "react";

import type { InputDisplayMode } from "@/hooks/useInputDisplayMode";
import type { ComponentSpec } from "@/models/componentSpec";
import { applyEmbeddedInputs } from "@/routes/v2/shared/nodes/embeddedInputs/applyEmbeddedInputs";
import { applyInputClustering } from "@/routes/v2/shared/nodes/InputClusterNode/applyInputClustering";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";

const EMPTY_RESULT: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

export function useSpecToNodesEdges(
  spec: ComponentSpec | null,
  inputDisplayMode: InputDisplayMode = "separate",
) {
  const registry = useNodeRegistry();
  const [result, setResult] = useState(EMPTY_RESULT);

  useEffect(() => {
    if (!spec) {
      setResult(EMPTY_RESULT);
      return;
    }

    const derivation = computed(() => {
      const nodes = registry.buildAllNodes(spec);
      const edges = registry.buildAllEdges(spec);
      // Transform input presentation within the reactive derivation so the
      // resulting nodes participate in React Flow state (live drag + autolayout
      // persistence work like any spec node).
      if (inputDisplayMode === "clustered") {
        return applyInputClustering(nodes, edges, spec);
      }
      if (inputDisplayMode === "embedded") {
        return applyEmbeddedInputs(nodes, edges);
      }
      return { nodes, edges };
    });

    return autorun(() => {
      setResult(derivation.get());
    });
  }, [spec, registry, inputDisplayMode]);

  return result;
}
