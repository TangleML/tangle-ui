import type { Edge, Node, XYPosition } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { INPUT_CLUSTERS_ANNOTATION } from "@/utils/annotations";

import { computeInputClusters } from "./clustering";
import type { InputClusterMember, InputClusterNodeData } from "./types";

interface ClusteringResult {
  nodes: Node[];
  edges: Edge[];
}

function centroid(positions: XYPosition[]): XYPosition {
  if (positions.length === 0) return { x: 0, y: 0 };
  const sum = positions.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / positions.length, y: sum.y / positions.length };
}

/**
 * Replaces individual input nodes that belong to a usage cluster with a single
 * aggregated `inputCluster` node exposing one output port per member input, and
 * reroutes their edges to those ports.
 *
 * Membership is derived from `spec.bindings`; only the per-cluster position is
 * persisted (in the `input-clusters` annotation), keyed by the deterministic
 * cluster id. Returns the inputs unchanged when there is nothing to cluster so
 * React Flow keeps stable references.
 */
export function applyInputClustering(
  nodes: Node[],
  edges: Edge[],
  spec: ComponentSpec,
): ClusteringResult {
  const clusters = computeInputClusters(spec);
  if (clusters.length === 0) return { nodes, edges };

  const inputNames = new Map(
    [...spec.inputs].map((input) => [input.$id, input.name]),
  );
  const nodePositions = new Map(nodes.map((node) => [node.id, node.position]));
  const persistedPositions = new Map(
    spec.annotations
      .get(INPUT_CLUSTERS_ANNOTATION)
      .map((meta) => [meta.id, meta.position]),
  );

  const inputToCluster = new Map<string, string>();
  const clusterNodes: Node[] = clusters.map((cluster) => {
    const members: InputClusterMember[] = cluster.inputEntityIds.map(
      (entityId) => {
        inputToCluster.set(entityId, cluster.id);
        return { entityId, name: inputNames.get(entityId) ?? entityId };
      },
    );

    const memberPositions = cluster.inputEntityIds
      .map((id) => nodePositions.get(id))
      .filter((p): p is XYPosition => p !== undefined);
    const position =
      persistedPositions.get(cluster.id) ?? centroid(memberPositions);

    return {
      id: cluster.id,
      type: "inputCluster",
      position,
      data: { clusterId: cluster.id, members } satisfies InputClusterNodeData,
      selectable: false,
      deletable: false,
      draggable: true,
    };
  });

  const remainingNodes = nodes.filter((node) => !inputToCluster.has(node.id));
  const clusteredNodes = [...remainingNodes, ...clusterNodes];

  const clusteredEdges = edges.map((edge) => {
    const clusterId = inputToCluster.get(edge.source);
    if (!clusterId) return edge;
    // buildBindingEdges already sets sourceHandle to `output_<inputEntityId>`,
    // which matches the aggregated node's per-member port id.
    return { ...edge, source: clusterId };
  });

  return { nodes: clusteredNodes, edges: clusteredEdges };
}
