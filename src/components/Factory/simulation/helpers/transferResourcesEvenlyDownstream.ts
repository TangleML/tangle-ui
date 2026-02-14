import type { Edge, Node } from "@xyflow/react";

import { getBuildingInstance } from "../../types/buildings";
import type { ResourceType } from "../../types/resources";
import type {
  BuildingStatistics,
  EdgeStatistics,
} from "../../types/statistics";
import { extractResource } from "../../utils/string";
import { transferResources } from "./transferResources";

/**
 * Transfers resources from a node to all its downstream neighbors,
 * splitting evenly when multiple targets want the same resource.
 * Handles remainders by distributing them round-robin.
 */
export const transferResourcesEvenlyDownstream = (
  sourceNodeId: string,
  downstreamNodes: string[],
  updatedNodes: Node[],
  edges: Edge[],
  buildingStats: Map<string, BuildingStatistics>,
  edgeStats: Map<string, EdgeStatistics>,
): void => {
  if (downstreamNodes.length === 0) return;

  const sourceNode = updatedNodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return;

  const building = getBuildingInstance(sourceNode);
  if (!building) return;

  // ✅ Map: resource -> array of target node IDs
  const resourceTargets = new Map<ResourceType, string[]>();

  downstreamNodes.forEach((neighborId) => {
    const relevantEdges = edges.filter(
      (e) => e.source === sourceNodeId && e.target === neighborId,
    );

    relevantEdges.forEach((edge) => {
      const resource =
        extractResource(edge.sourceHandle) ||
        extractResource(edge.targetHandle);
      if (!resource) return;

      if (!resourceTargets.has(resource)) {
        resourceTargets.set(resource, []);
      }

      resourceTargets.get(resource)!.push(neighborId);
    });
  });

  // ✅ For each resource, calculate splits and handle remainders
  resourceTargets.forEach((targets, resource) => {
    const sourceStock = building.stockpile?.find(
      (s) => s.resource === resource,
    );
    if (!sourceStock || sourceStock.amount === 0) return;

    const splitCount = targets.length;
    const baseAmount = Math.floor(sourceStock.amount / splitCount);
    const remainder = sourceStock.amount % splitCount;

    // ✅ Calculate capacity for each target
    const targetCapacities = new Map<string, number>();

    targets.forEach((targetId) => {
      const targetNode = updatedNodes.find((n) => n.id === targetId);
      if (!targetNode) return;

      const targetBuilding = getBuildingInstance(targetNode);
      if (!targetBuilding) return;

      const targetStock = targetBuilding.stockpile?.find(
        (s) => s.resource === resource || s.resource === "any",
      );

      if (targetStock) {
        const availableSpace = targetStock.maxAmount - targetStock.amount;
        targetCapacities.set(targetId, availableSpace);
      }
    });

    // ✅ First pass: allocate base amounts (respecting capacity)
    const allocations = new Map<string, number>();
    let totalAllocated = 0;

    targets.forEach((targetId, index) => {
      const capacity = targetCapacities.get(targetId) || 0;

      // Base amount + 1 extra for first 'remainder' targets (round-robin)
      let allocation = baseAmount + (index < remainder ? 1 : 0);
      allocation = Math.min(allocation, capacity);

      allocations.set(targetId, allocation);
      totalAllocated += allocation;
    });

    // ✅ Second pass: redistribute leftovers if some targets couldn't take their full share
    const leftover = sourceStock.amount - totalAllocated;

    if (leftover > 0) {
      // Try to give leftovers to targets that still have capacity
      let remainingLeftover = leftover;

      for (const [targetId, currentAllocation] of allocations) {
        if (remainingLeftover === 0) break;

        const capacity = targetCapacities.get(targetId) || 0;
        const canTakeMore = capacity - currentAllocation;

        if (canTakeMore > 0) {
          const additionalAmount = Math.min(canTakeMore, remainingLeftover);
          allocations.set(targetId, currentAllocation + additionalAmount);
          remainingLeftover -= additionalAmount;
        }
      }
    }

    // ✅ Perform transfers with calculated allocations
    allocations.forEach((amount, targetId) => {
      if (amount > 0) {
        transferResources(
          sourceNodeId,
          targetId,
          updatedNodes,
          edges,
          buildingStats,
          edgeStats,
          amount,
        );
      }
    });
  });
};
