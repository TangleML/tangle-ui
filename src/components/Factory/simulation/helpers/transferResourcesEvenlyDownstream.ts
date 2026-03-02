import type { Edge, Node } from "@xyflow/react";

import { getBuildingInstance } from "../../types/buildings";
import { isResourceData, type ResourceType } from "../../types/resources";
import type {
  BuildingStatistics,
  EdgeStatistics,
} from "../../types/statistics";
import { transferResources } from "./transferResources";

/**
 * Transfers resources from a node to all its downstream neighbors,
 * splitting evenly when multiple targets want the same resource.
 * Handles remainders by distributing them round-robin.
 * Supports "any" stockpiles by checking breakdown for available resources.
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

  // ✅ Map: resource -> array of target node IDs that want this resource
  const resourceTargets = new Map<ResourceType, string[]>();

  downstreamNodes.forEach((neighborId) => {
    const relevantEdges = edges.filter(
      (e) => e.source === sourceNodeId && e.target === neighborId,
    );

    relevantEdges.forEach((edge) => {
      if (!isResourceData(edge.data)) return;

      const resource = edge.data.type;

      if (!resource) return;

      if (!resourceTargets.has(resource)) {
        resourceTargets.set(resource, []);
      }

      resourceTargets.get(resource)!.push(neighborId);
    });
  });

  // ✅ For each resource type requested by downstream nodes
  resourceTargets.forEach((targets, resource) => {
    // Check if source has this resource (either directly or in "any" breakdown)
    const directStock = building.stockpile?.find(
      (s) => s.resource === resource,
    );

    const anyStock = building.stockpile?.find((s) => s.resource === "any");
    const amountInBreakdown = anyStock?.breakdown?.get(resource) || 0;

    const availableAmount = directStock
      ? directStock.amount
      : amountInBreakdown;

    // Skip if no resources available
    if (availableAmount === 0) return;

    const splitCount = targets.length;
    const baseAmount = Math.floor(availableAmount / splitCount);
    const remainder = availableAmount % splitCount;

    // ✅ Calculate capacity for each target (only if they can accept this resource type)
    const targetCapacities = new Map<string, number>();

    targets.forEach((targetId) => {
      const targetNode = updatedNodes.find((n) => n.id === targetId);
      if (!targetNode) return;

      const targetBuilding = getBuildingInstance(targetNode);
      if (!targetBuilding) return;

      // ✅ Find a stockpile that can accept this specific resource
      const targetStock = targetBuilding.stockpile?.find(
        (s) => s.resource === resource || s.resource === "any",
      );

      if (targetStock) {
        const availableSpace = targetStock.maxAmount - targetStock.amount;
        targetCapacities.set(targetId, availableSpace);
      } else {
        // Target cannot accept this resource type - capacity is 0
        targetCapacities.set(targetId, 0);
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
    const leftover = availableAmount - totalAllocated;

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
