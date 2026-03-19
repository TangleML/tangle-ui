import type { Edge, Node } from "@xyflow/react";
import { useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";

const EMPTY_RESULT: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

export function useSpecToNodesEdges(spec: ComponentSpec | null) {
  const registry = useNodeRegistry();
  const cacheRef = useRef<{
    fingerprint: string;
    result: { nodes: Node[]; edges: Edge[] };
  } | null>(null);

  if (!spec) return EMPTY_RESULT;

  const fingerprint = registry.buildFingerprint(spec);

  if (cacheRef.current && cacheRef.current.fingerprint === fingerprint) {
    return cacheRef.current.result;
  }

  const nodes = registry.buildAllNodes(spec);
  const edges = registry.buildAllEdges(spec);

  const result = { nodes, edges };
  cacheRef.current = { fingerprint, result };
  return result;
}
