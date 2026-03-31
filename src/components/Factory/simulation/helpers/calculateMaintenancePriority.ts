import type { Edge, Node } from "@xyflow/react";

import { getBuildingInstance } from "../../types/buildings";

/** Money sink building types — these are the BFS starting points */
const MONEY_SINK_TYPES = ["marketplace", "tradingpost"];

/**
 * Calculate each building's priority for maintenance budget allocation.
 * Uses BFS walking upstream from money sinks (marketplaces/trading posts).
 *
 * Lower distance = closer to a money sink = higher priority to keep running.
 * Buildings not connected to any money sink get Infinity.
 */
export function calculateMaintenancePriority(
  nodes: Node[],
  edges: Edge[],
): Map<string, number> {
  const priority = new Map<string, number>();

  // Build upstream adjacency: for each node, which nodes feed into it
  const upstream = new Map<string, string[]>();
  nodes.forEach((node) => upstream.set(node.id, []));
  edges.forEach((edge) => {
    upstream.get(edge.target)?.push(edge.source);
  });

  // Seed BFS with money sink nodes at distance 0
  const queue: Array<{ nodeId: string; distance: number }> = [];

  for (const node of nodes) {
    const instance = getBuildingInstance(node);
    if (instance && MONEY_SINK_TYPES.includes(instance.type)) {
      priority.set(node.id, 0);
      queue.push({ nodeId: node.id, distance: 0 });
    }
  }

  // BFS upstream
  while (queue.length > 0) {
    const { nodeId, distance } = queue.shift()!;
    const sources = upstream.get(nodeId) || [];

    for (const sourceId of sources) {
      const existingDistance = priority.get(sourceId);
      const newDistance = distance + 1;

      // Only update if we found a shorter path
      if (existingDistance === undefined || newDistance < existingDistance) {
        priority.set(sourceId, newDistance);
        queue.push({ nodeId: sourceId, distance: newDistance });
      }
    }
  }

  // Nodes not reached get Infinity
  for (const node of nodes) {
    if (!priority.has(node.id)) {
      priority.set(node.id, Infinity);
    }
  }

  return priority;
}
