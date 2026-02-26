import dagre from "@dagrejs/dagre";
import type { Edge, Node, XYPosition } from "@xyflow/react";

import { DEFAULT_NODE_DIMENSIONS } from "@/utils/constants";

export type LayoutAlgorithm =
  | "sugiyama"
  | "sugiyama_centered"
  | "digco"
  | "dwyer";

export const autoLayoutNodes = (
  nodes: Node[],
  edges: Edge[],
  algorithm: LayoutAlgorithm = "sugiyama",
): Node[] => {
  const dagreGraph = new dagre.graphlib.Graph();

  let config;
  switch (algorithm) {
    case "sugiyama_centered":
      config = {
        rankdir: "LR",
        ranker: "network-simplex",
        nodesep: 30,
        edgesep: 10,
        ranksep: 20,
      };
      break;
    case "digco":
      config = {
        rankdir: "LR",
        ranker: "tight-tree",
        nodesep: 30,
        edgesep: 10,
        ranksep: 80,
      };
      break;
    case "dwyer":
      config = {
        rankdir: "LR",
        ranker: "longest-path",
        nodesep: 60,
        edgesep: 15,
        ranksep: 100,
      };
      break;
    case "sugiyama":
    default:
      config = {
        rankdir: "LR",
        ranker: "network-simplex",
        nodesep: 40,
        edgesep: 20,
        ranksep: 80,
      };
  }

  dagreGraph.setGraph(config);
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.measured?.width,
      height: node.measured?.height,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Apply custom centering for sugiyama_centered
  let centeredPositions: Map<string, XYPosition> | null = null;
  if (algorithm === "sugiyama_centered") {
    centeredPositions = centerNodesInBuckets(nodes, dagreGraph, config);
  }

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    let position;
    if (centeredPositions && centeredPositions.has(node.id)) {
      const centered = centeredPositions.get(node.id)!;
      position = {
        x: centered.x - (node?.measured?.width || 0) / 2,
        y: centered.y - (node?.measured?.height || 0) / 2,
      };
    } else {
      position = {
        x: nodeWithPosition.x - (node?.measured?.width || 0) / 2,
        y: nodeWithPosition.y - (node?.measured?.height || 0) / 2,
      };
    }

    return {
      ...node,
      position,
    };
  });
};

/**
 * Center nodes vertically within horizontal buckets.
 * After Sugiyama layout, nodes may be spread vertically. This function:
 * 1. Buckets nodes by x position (rank)
 * 2. Within each bucket, sorts nodes by distance from global average y
 * 3. Places nodes as close as possible to center without overlapping
 *
 * This algorithm was adapted by AI directly from the tangle-deploy source code:
 * https://github.com/Shopify/discovery/blob/main/oasis/tangle-deploy/src/tangle_deploy/auto_layout.py#L35
 */
function centerNodesInBuckets(
  nodes: Node[],
  dagreGraph: dagre.graphlib.Graph,
  config: {
    nodesep: number;
    rankdir?: string;
    ranker?: string;
    edgesep?: number;
    ranksep?: number;
  },
): Map<string, XYPosition> {
  const positions = new Map<
    string,
    XYPosition & { width: number; height: number }
  >();

  // Initialize buckets
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    positions.set(node.id, {
      x: nodeWithPosition.x,
      y: nodeWithPosition.y,
      width: node.measured?.width || DEFAULT_NODE_DIMENSIONS.w || 300,
      height: node.measured?.height || DEFAULT_NODE_DIMENSIONS.h || 300,
    });
  });

  if (nodes.length === 0) return new Map();

  const allY = Array.from(positions.values()).map((p) => p.y);
  const avgY = allY.reduce((sum, y) => sum + y, 0) / allY.length;

  const buckets = new Map<number, string[]>();

  for (const [nodeId, pos] of positions.entries()) {
    const bucketIdx = Math.round(pos.x);
    if (!buckets.has(bucketIdx)) {
      buckets.set(bucketIdx, []);
    }
    buckets.get(bucketIdx)!.push(nodeId);
  }

  const centeredPositions = new Map<string, XYPosition>();

  // Process each bucket
  for (const [_, nodeIds] of buckets.entries()) {
    if (nodeIds.length === 1) {
      const pos = positions.get(nodeIds[0])!;
      centeredPositions.set(nodeIds[0], {
        x: pos.x,
        y: avgY,
      });
      continue;
    }

    const bucketAvgY =
      nodeIds.reduce((sum, id) => sum + positions.get(id)!.y, 0) /
      nodeIds.length;

    nodeIds.sort((a, b) => {
      const distA = Math.abs(positions.get(a)!.y - bucketAvgY);
      const distB = Math.abs(positions.get(b)!.y - bucketAvgY);
      return distA - distB;
    });

    let occupiedMin: number | null = null;
    let occupiedMax: number | null = null;

    for (const nodeId of nodeIds) {
      const pos = positions.get(nodeId)!;
      const originalY = pos.y;
      const height = pos.height;

      let centeredY: number;

      if (occupiedMin === null) {
        centeredY = avgY;
        occupiedMin = avgY - height / 2 - config.nodesep;
        occupiedMax = avgY + height / 2 + config.nodesep;
      } else if (originalY < bucketAvgY) {
        centeredY = occupiedMin - height / 2;
        occupiedMin = centeredY - height / 2 - config.nodesep;
      } else {
        centeredY = (occupiedMax || 0) + height / 2;
        occupiedMax = centeredY + height / 2 + config.nodesep;
      }

      centeredPositions.set(nodeId, {
        x: pos.x,
        y: centeredY,
      });
    }
  }

  return centeredPositions;
}
