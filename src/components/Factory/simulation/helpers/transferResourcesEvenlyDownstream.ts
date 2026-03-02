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
 * Handles "any" type edges and stockpiles correctly.
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

  // ✅ Step 1: Determine ALL resources available at source
  const availableResources = new Set<ResourceType>();

  building.stockpile?.forEach((stock) => {
    if (stock.resource === "any" && stock.breakdown) {
      // Add all resources in breakdown
      stock.breakdown.forEach((amount, resource) => {
        if (amount > 0) {
          availableResources.add(resource);
        }
      });
    } else if (stock.amount > 0) {
      // Add direct stockpile resource
      availableResources.add(stock.resource);
    }
  });

  // ✅ Step 2: For each available resource, determine which downstream nodes want it
  const resourceTargets = new Map<ResourceType, string[]>();

  availableResources.forEach((resource) => {
    const targets: string[] = [];

    downstreamNodes.forEach((neighborId) => {
      const relevantEdges = edges.filter(
        (e) => e.source === sourceNodeId && e.target === neighborId,
      );

      // Check if any edge can carry this resource
      const hasEdgeForResource = relevantEdges.some((edge) => {
        if (!isResourceData(edge.data)) return false;
        const edgeResource = edge.data.type;
        // Edge can carry if it's the specific resource OR if it's "any"
        return edgeResource === resource || edgeResource === "any";
      });

      if (hasEdgeForResource) {
        targets.push(neighborId);
      }
    });

    if (targets.length > 0) {
      resourceTargets.set(resource, targets);
    }
  });

  // ✅ Step 3: For each resource, calculate fair split among targets
  resourceTargets.forEach((targets, resource) => {
    // Get available amount (from direct stockpile or "any" breakdown)
    const directStock = building.stockpile?.find(
      (s) => s.resource === resource,
    );
    const anyStock = building.stockpile?.find((s) => s.resource === "any");
    const amountInBreakdown = anyStock?.breakdown?.get(resource) || 0;

    const availableAmount = directStock
      ? directStock.amount
      : amountInBreakdown;

    if (availableAmount === 0) return;

    const splitCount = targets.length;
    const baseAmount = Math.floor(availableAmount / splitCount);
    const remainder = availableAmount % splitCount;

    // ✅ Calculate capacity for each target
    const targetCapacities = new Map<string, number>();

    targets.forEach((targetId) => {
      const targetNode = updatedNodes.find((n) => n.id === targetId);
      if (!targetNode) return;

      const targetBuilding = getBuildingInstance(targetNode);
      if (!targetBuilding) return;

      // Find a stockpile that can accept this specific resource
      const targetStock = targetBuilding.stockpile?.find(
        (s) => s.resource === resource || s.resource === "any",
      );

      if (targetStock) {
        const availableSpace = targetStock.maxAmount - targetStock.amount;
        targetCapacities.set(targetId, availableSpace);
      } else {
        targetCapacities.set(targetId, 0);
      }
    });

    // ✅ Allocate base amounts + remainder (round-robin)
    const allocations = new Map<string, number>();
    let totalAllocated = 0;

    targets.forEach((targetId, index) => {
      const capacity = targetCapacities.get(targetId) || 0;
      let allocation = baseAmount + (index < remainder ? 1 : 0);
      allocation = Math.min(allocation, capacity);

      allocations.set(targetId, allocation);
      totalAllocated += allocation;
    });

    // ✅ Redistribute leftovers if some targets hit capacity
    const leftover = availableAmount - totalAllocated;

    if (leftover > 0) {
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

    // ✅ Step 4: Perform transfers with calculated allocations
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
