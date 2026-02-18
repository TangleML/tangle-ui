import type { Edge, Node } from "@xyflow/react";

import { RESOURCES } from "../data/resources";
import { getBuildingData } from "../types/buildings";
import type {
  BuildingStatistics,
  DayStatistics,
  EdgeStatistics,
} from "../types/statistics";
import { advanceProduction } from "./helpers/advanceProduction";
import { processGlobalOutputBuilding } from "./helpers/processGlobalOutputBuilding";
import { transferResources } from "./helpers/transferResources";

interface ProcessDayResult {
  updatedNodes: Node[];
  globalOutputs: Record<string, number>;
  statistics: DayStatistics;
}

// Removed currentMoney and currentKnowledge parameters - now dynamic
export const processDay = (
  nodes: Node[],
  edges: Edge[],
  currentDay: number,
  currentResources: Record<string, number>,
): ProcessDayResult => {
  const updatedNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data },
  }));

  // Initialize global outputs dynamically
  const globalOutputs: Record<string, number> = {};

  // Initialize statistics tracking
  const buildingStats = new Map<string, BuildingStatistics>();
  const edgeStats = new Map<string, EdgeStatistics>();

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

  // Find sink nodes (buildings that produce global outputs)
  const sinkNodes = updatedNodes.filter((node) => {
    const building = getBuildingData(node);
    return building?.productionMethod?.outputs.some(
      (output) => RESOURCES[output.resource]?.global,
    );
  });

  // Track visited nodes for BFS
  const visited = new Set<string>();

  // STEP 1: Process global output buildings (sinks)
  sinkNodes.forEach((node) => {
    processGlobalOutputBuilding(node, globalOutputs, buildingStats);
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
      transferResources(
        nodeId,
        downstreamId,
        updatedNodes,
        edges,
        buildingStats,
        edgeStats,
      );
    });
  });

  // STEP 3: Advance production for all non-sink nodes
  processingOrder.forEach((nodeId) => {
    const node = updatedNodes.find((n) => n.id === nodeId);
    if (node) {
      advanceProduction(node, buildingStats);
    }
  });

  // Handle disconnected nodes (not connected to any sink)
  updatedNodes.forEach((node) => {
    if (!visited.has(node.id)) {
      // Transfer to any downstream connections
      const downstreamNodes = downstreamMap.get(node.id) || [];
      downstreamNodes.forEach((downstreamId) => {
        transferResources(
          node.id,
          downstreamId,
          updatedNodes,
          edges,
          buildingStats,
          edgeStats,
        );
      });

      // Advance production
      advanceProduction(node, buildingStats);
      visited.add(node.id);
    }
  });

  // Build final statistics object with dynamic resources
  const updatedResources: Record<string, number> = { ...currentResources };
  const earned: Record<string, number> = {};

  // Update all global resources that were produced
  Object.entries(globalOutputs).forEach(([resource, amount]) => {
    updatedResources[resource] = (updatedResources[resource] || 0) + amount;
    earned[resource] = amount;
  });

  const statistics: DayStatistics = {
    global: {
      day: currentDay,
      resources: updatedResources,
      earned,
    },
    buildings: buildingStats,
    edges: edgeStats,
  };

  return { updatedNodes, globalOutputs, statistics };
};
