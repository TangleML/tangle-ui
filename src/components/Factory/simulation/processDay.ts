import type { Edge, Node } from "@xyflow/react";

import { SPECIAL_BUILDINGS } from "../data/buildings";
import { GLOBAL_RESOURCE_KEYS, type GlobalResources } from "../data/resources";
import { getBuildingInstance } from "../types/buildings";
import type {
  BuildingStatistics,
  DayStatistics,
  EdgeStatistics,
  GlobalStatistics,
} from "../types/statistics";
import { advanceProduction } from "./helpers/advanceProduction";
import { calculateFoodRequirement } from "./helpers/calculateFoodRequirement";
import { processSpecialBuilding } from "./helpers/processSpecialBuilding";
import { transferResourcesEvenlyDownstream } from "./helpers/transferResourcesEvenlyDownstream";

export const processDay = (
  nodes: Node[],
  edges: Edge[],
  day: number,
  currentResources: GlobalResources,
  previousDayStats?: DayStatistics,
): {
  updatedNodes: Node[];
  statistics: DayStatistics;
} => {
  const updatedNodes = structuredClone(nodes);
  const earnedGlobalResources = Object.fromEntries(
    GLOBAL_RESOURCE_KEYS.map((key) => [key, 0]),
  ) as GlobalResources;

  // Initialize statistics
  const buildingStats = new Map<string, BuildingStatistics>();
  const edgeStats = new Map<string, EdgeStatistics>();

  // Build adjacency lists (both forward and reverse)
  const downstream = new Map<string, string[]>(); // node -> nodes it outputs to
  const upstream = new Map<string, string[]>(); // node -> nodes that output to it
  const outDegree = new Map<string, number>(); // how many downstream nodes

  updatedNodes.forEach((node) => {
    downstream.set(node.id, []);
    upstream.set(node.id, []);
    outDegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    downstream.get(edge.source)?.push(edge.target);
    upstream.get(edge.target)?.push(edge.source);
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
  });

  // ✅ STEP 1: Find all sink nodes (nodes with no downstream connections)
  const queue: string[] = [];
  updatedNodes.forEach((node) => {
    if (outDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });

  const processed = new Set<string>();

  // ✅ STEP 2: Process nodes from sinks upstream
  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (processed.has(currentNodeId)) continue;

    const currentNode = updatedNodes.find((n) => n.id === currentNodeId);
    if (!currentNode) continue;

    const building = getBuildingInstance(currentNode);
    if (!building) continue;

    // ✅ STEP 2.1: If there is downstream, transfer resources downstream
    const downstreamNodes = downstream.get(currentNodeId) || [];
    transferResourcesEvenlyDownstream(
      currentNodeId,
      downstreamNodes,
      updatedNodes,
      edges,
      buildingStats,
      edgeStats,
    );

    // ✅ STEP 2.2: If special node, process special, otherwise advance production
    if (SPECIAL_BUILDINGS.includes(building.type)) {
      processSpecialBuilding(currentNode, earnedGlobalResources, buildingStats);
    } else {
      advanceProduction(currentNode, earnedGlobalResources, buildingStats);
    }

    // Mark as processed
    processed.add(currentNodeId);

    // ✅ STEP 2.3: Move upstream - add upstream nodes if all their downstream nodes are processed
    const upstreamNodes = upstream.get(currentNodeId) || [];
    upstreamNodes.forEach((upstreamNodeId) => {
      const upstreamDownstreamNodes = downstream.get(upstreamNodeId) || [];
      const allDownstreamProcessed = upstreamDownstreamNodes.every((id) =>
        processed.has(id),
      );

      if (allDownstreamProcessed && !processed.has(upstreamNodeId)) {
        queue.push(upstreamNodeId);
      }
    });
  }

  // ✅ STEP 3: Calculate food requirement and deduct
  const previousRequirement = previousDayStats?.global.foodRequired;
  const foodRequired = calculateFoodRequirement(day, previousRequirement);

  const foodConsumed = Math.min(
    foodRequired,
    currentResources.food + earnedGlobalResources.food,
  );
  const foodDeficit = Math.max(0, foodRequired - foodConsumed);

  // Deduct consumed food from earned resources first, then current resources
  earnedGlobalResources.food -= foodConsumed;

  const finalResources = { ...currentResources };

  GLOBAL_RESOURCE_KEYS.forEach((key) => {
    finalResources[key] += earnedGlobalResources[key];
  });

  // Build global statistics
  const globalStats: GlobalStatistics = {
    day,
    earned: earnedGlobalResources,
    resources: finalResources,
    foodRequired,
    foodConsumed,
    foodDeficit,
  };

  return {
    updatedNodes,
    statistics: {
      global: globalStats,
      buildings: buildingStats,
      edges: edgeStats,
    },
  };
};
