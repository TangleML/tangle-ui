import "../nodes"; // ensure manifests are registered

import type { Edge, Node } from "@xyflow/react";
import { useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { NODE_TYPE_REGISTRY } from "../nodes/registry";

const EMPTY_RESULT: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

export function useSpecToNodesEdges(spec: ComponentSpec | null) {
  const cacheRef = useRef<{
    fingerprint: string;
    result: { nodes: Node[]; edges: Edge[] };
  } | null>(null);

  if (!spec) return EMPTY_RESULT;

  const fingerprint = NODE_TYPE_REGISTRY.buildFingerprint(spec);

  if (cacheRef.current && cacheRef.current.fingerprint === fingerprint) {
    return cacheRef.current.result;
  }

  const nodes = NODE_TYPE_REGISTRY.buildAllNodes(spec);
  const edges = NODE_TYPE_REGISTRY.buildAllEdges(spec);

  const result = { nodes, edges };
  cacheRef.current = { fingerprint, result };
  return result;
}
