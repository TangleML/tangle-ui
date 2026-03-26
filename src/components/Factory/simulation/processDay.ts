import type { Edge, Node } from "@xyflow/react";

import { getBuildingData } from "../types/buildings";
import { advanceProduction } from "./helpers/advanceProduction";
import { processGlobalOutputBuilding } from "./helpers/processGlobalOutputBuilding";
import { transferResources } from "./helpers/transferResources";

interface ProcessDayResult {
  updatedNodes: Node[];
  globalOutputs: {
    coins: number;
    knowledge: number;
  };
}

// Breadth-first processing of the graph, starting from sink nodes (global output buildings) and moving upstream
// Consider switching to Topological Sort
export const processDay = (nodes: Node[], edges: Edge[]): ProcessDayResult => {
  const updatedNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data },
  }));
  const globalOutputs = { coins: 0, knowledge: 0 };

  // Build adjacency maps
  const upstreamMap = new Map<string, string[]>();
  const downstreamMap = new Map<string, string[]>();

  edges.forEach((edge) => {
    // Upstream map: target -> sources
    if (!upstreamMap.has(edge.target)) {
      upstreamMap.set(edge.target, []);
    }
    upstreamMap.get(edge.target)!.push(edge.source);

    // Downstream map: source -> targets
    if (!downstreamMap.has(edge.source)) {
      downstreamMap.set(edge.source, []);
    }
    downstreamMap.get(edge.source)!.push(edge.target);
  });

  // Find sink nodes (global output buildings)
  const sinkNodes = updatedNodes.filter((node) => {
    const building = getBuildingData(node);
    return building?.productionMethod?.globalOutputs !== undefined;
  });

  // Track visited nodes for BFS
  const visited = new Set<string>();

  // STEP 1: Process global output buildings (sinks)
  sinkNodes.forEach((node) => {
    processGlobalOutputBuilding(node, globalOutputs);
    visited.add(node.id);
  });

  // Build processing order via BFS from sinks
  const processingOrder: string[] = [];
  const queue: string[] = [...sinkNodes.map((n) => n.id)];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    const upstreamNodes = upstreamMap.get(nodeId) || [];
    upstreamNodes.forEach((upstreamId) => {
      if (!visited.has(upstreamId)) {
        visited.add(upstreamId);
        processingOrder.push(upstreamId);
        queue.push(upstreamId);
      }
    });
  }

  // STEP 2: Transfer resources (in reverse order - from upstream to downstream)
  processingOrder.forEach((nodeId) => {
    const downstreamNodes = downstreamMap.get(nodeId) || [];
    downstreamNodes.forEach((downstreamId) => {
      transferResources(nodeId, downstreamId, updatedNodes, edges);
    });
  });

  // STEP 3: Advance production for all non-sink nodes
  processingOrder.forEach((nodeId) => {
    const node = updatedNodes.find((n) => n.id === nodeId);
    if (node) {
      advanceProduction(node);
    }
  });

  // Handle disconnected nodes (not connected to any sink)
  updatedNodes.forEach((node) => {
    if (!visited.has(node.id)) {
      // Transfer to any downstream connections
      const downstreamNodes = downstreamMap.get(node.id) || [];
      downstreamNodes.forEach((downstreamId) => {
        transferResources(node.id, downstreamId, updatedNodes, edges);
      });

      // Advance production
      advanceProduction(node);
      visited.add(node.id);
    }
  });

  return { updatedNodes, globalOutputs };
};
