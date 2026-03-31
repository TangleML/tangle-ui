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
import { calculateMaintenancePriority } from "./helpers/calculateMaintenancePriority";
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

  // Calculate maintenance priority (BFS distance from money sinks)
  const maintenancePriority = calculateMaintenancePriority(updatedNodes, edges);
  let maintenanceBudget = currentResources.money;
  let totalMaintenancePaid = 0;

  // Knowledge budget for advanced production methods
  let knowledgeBudget = currentResources.knowledge;
  let totalKnowledgePaid = 0;

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
  // Sort by maintenance priority (closest to money sinks first) for budget fairness
  const queue: string[] = [];
  const sinkNodes: string[] = [];
  updatedNodes.forEach((node) => {
    if (outDegree.get(node.id) === 0) {
      sinkNodes.push(node.id);
    }
  });
  sinkNodes.sort(
    (a, b) =>
      (maintenancePriority.get(a) ?? Infinity) -
      (maintenancePriority.get(b) ?? Infinity),
  );
  queue.push(...sinkNodes);

  const processed = new Set<string>();

  // ✅ STEP 2: Process nodes from sinks upstream
  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (processed.has(currentNodeId)) continue;

    const currentNode = updatedNodes.find((n) => n.id === currentNodeId);
    if (!currentNode) continue;

    const building = getBuildingInstance(currentNode);
    if (!building) continue;

    // Initialize stats for this building
    if (!buildingStats.has(currentNodeId)) {
      buildingStats.set(currentNodeId, { stockpileChanges: [] });
    }

    // ✅ STEP 2.1: Transfer resources downstream (always happens, even if paused)
    const downstreamNodes = downstream.get(currentNodeId) || [];
    transferResourcesEvenlyDownstream(
      currentNodeId,
      downstreamNodes,
      updatedNodes,
      edges,
      buildingStats,
      edgeStats,
    );

    // ✅ STEP 2.2: Check maintenance before production
    const maintenanceCost = building.maintenance ?? 0;
    let maintenancePaused = false;

    if (maintenanceCost > 0) {
      // Only charge maintenance if the building is not idle (actively working)
      const isWorking =
        building.productionState?.status === "active" ||
        building.productionState?.status === "complete" ||
        building.productionState?.status === "paused"; // paused due to output full, still "working"

      if (isWorking) {
        if (maintenanceBudget >= maintenanceCost) {
          // Can afford — pay maintenance
          maintenanceBudget -= maintenanceCost;
          totalMaintenancePaid += maintenanceCost;
          const stats = buildingStats.get(currentNodeId)!;
          stats.maintenancePaid = maintenanceCost;
        } else {
          // Cannot afford — pause for maintenance
          maintenancePaused = true;
          const stats = buildingStats.get(currentNodeId)!;
          stats.maintenancePaused = true;

          // Force building into paused state
          currentNode.data.buildingInstance = {
            ...building,
            productionState: {
              progress: building.productionState?.progress ?? 0,
              status: "paused",
            },
          };
        }
      }
    }

    // ✅ STEP 2.2b: Check knowledge cost before production
    const knowledgeCost = building.productionMethod?.knowledgeCost ?? 0;
    let knowledgePaused = false;

    if (!maintenancePaused && knowledgeCost > 0) {
      const isWorking =
        building.productionState?.status === "active" ||
        building.productionState?.status === "complete" ||
        building.productionState?.status === "paused";

      if (isWorking) {
        if (knowledgeBudget >= knowledgeCost) {
          knowledgeBudget -= knowledgeCost;
          totalKnowledgePaid += knowledgeCost;
          const stats = buildingStats.get(currentNodeId)!;
          stats.knowledgePaid = knowledgeCost;
        } else {
          knowledgePaused = true;
          const stats = buildingStats.get(currentNodeId)!;
          stats.knowledgePaused = true;

          currentNode.data.buildingInstance = {
            ...building,
            productionState: {
              progress: building.productionState?.progress ?? 0,
              status: "paused",
            },
          };
        }
      }
    }

    // ✅ STEP 2.3: Process production (skip if maintenance-paused or knowledge-paused)
    if (!maintenancePaused && !knowledgePaused) {
      if (SPECIAL_BUILDINGS.includes(building.type)) {
        processSpecialBuilding(
          currentNode,
          earnedGlobalResources,
          buildingStats,
        );

        // When a marketplace/trading post earns money, add to maintenance budget
        const moneyEarned = buildingStats.get(currentNodeId)?.produced?.money;
        if (moneyEarned && moneyEarned > 0) {
          maintenanceBudget += moneyEarned;
        }

        // When a library earns knowledge, add to knowledge budget
        const knowledgeEarned =
          buildingStats.get(currentNodeId)?.produced?.knowledge;
        if (knowledgeEarned && knowledgeEarned > 0) {
          knowledgeBudget += knowledgeEarned;
        }
      } else {
        advanceProduction(currentNode, earnedGlobalResources, buildingStats);
      }
    }

    // Mark as processed
    processed.add(currentNodeId);

    // ✅ STEP 2.4: Move upstream - add upstream nodes if all their downstream nodes are processed
    // Sort by priority so closer-to-market buildings get budget first
    const upstreamNodes = upstream.get(currentNodeId) || [];
    const readyUpstream: string[] = [];
    upstreamNodes.forEach((upstreamNodeId) => {
      const upstreamDownstreamNodes = downstream.get(upstreamNodeId) || [];
      const allDownstreamProcessed = upstreamDownstreamNodes.every((id) =>
        processed.has(id),
      );

      if (allDownstreamProcessed && !processed.has(upstreamNodeId)) {
        readyUpstream.push(upstreamNodeId);
      }
    });
    readyUpstream.sort(
      (a, b) =>
        (maintenancePriority.get(a) ?? Infinity) -
        (maintenancePriority.get(b) ?? Infinity),
    );
    queue.push(...readyUpstream);
  }

  // Deduct total maintenance from earned money
  earnedGlobalResources.money -= totalMaintenancePaid;

  // Deduct total knowledge cost from earned knowledge
  earnedGlobalResources.knowledge -= totalKnowledgePaid;

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
    maintenanceCost: totalMaintenancePaid,
    knowledgeCost: totalKnowledgePaid,
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
