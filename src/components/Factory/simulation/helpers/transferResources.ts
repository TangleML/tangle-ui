import type { Edge, Node } from "@xyflow/react";

import {
  type BuildingInstance,
  getBuildingInstance,
} from "../../types/buildings";
import { isResourceData, type ResourceType } from "../../types/resources";
import type {
  BuildingStatistics,
  EdgeStatistics,
  StockpileChange,
} from "../../types/statistics";

export const transferResources = (
  sourceNodeId: string,
  targetNodeId: string,
  updatedNodes: Node[],
  edges: Edge[],
  buildingStats: Map<string, BuildingStatistics>,
  edgeStats: Map<string, EdgeStatistics>,
  transferAmount?: number,
) => {
  const sourceNode = updatedNodes.find((n) => n.id === sourceNodeId);
  const targetNode = updatedNodes.find((n) => n.id === targetNodeId);

  if (!sourceNode || !targetNode) return;

  // ✅ Get FRESH building instances each time (after mutations)
  const sourceBuilding = getBuildingInstance(sourceNode);
  const targetBuilding = getBuildingInstance(targetNode);

  if (!sourceBuilding || !targetBuilding) return;

  // Initialize stats for both buildings if needed
  if (!buildingStats.has(sourceNodeId)) {
    buildingStats.set(sourceNodeId, { stockpileChanges: [] });
  }
  if (!buildingStats.has(targetNodeId)) {
    buildingStats.set(targetNodeId, { stockpileChanges: [] });
  }

  const sourceStats = buildingStats.get(sourceNodeId)!;
  const targetStats = buildingStats.get(targetNodeId)!;

  // Find edges between these nodes
  const relevantEdges = edges.filter(
    (e) => e.source === sourceNodeId && e.target === targetNodeId,
  );

  relevantEdges.forEach((edge) => {
    if (!isResourceData(edge.data)) return;
    const edgeResource = edge.data.type;

    if (!edgeResource) return;

    // ✅ Get FRESH building data for each edge (important for multiple edges between same nodes)
    const currentSourceBuilding = getBuildingInstance(sourceNode);
    const currentTargetBuilding = getBuildingInstance(targetNode);

    if (!currentSourceBuilding || !currentTargetBuilding) return;

    // ✅ Determine which resources to transfer based on edge type
    const resourcesToTransfer: ResourceType[] = [];

    if (edgeResource === "any") {
      // For "any" edge, transfer all resources in the "any" stockpile breakdown
      const sourceAnyStock = currentSourceBuilding.stockpile?.find(
        (s) => s.resource === "any",
      );
      if (sourceAnyStock?.breakdown) {
        resourcesToTransfer.push(...sourceAnyStock.breakdown.keys());
      }
    } else {
      // For specific resource edge, transfer just that resource
      resourcesToTransfer.push(edgeResource);
    }

    // ✅ For "any" edges, transfer ALL of each resource (no limit per resource)
    // For specific edges, respect the transferAmount
    if (edgeResource === "any") {
      // Transfer unlimited for each resource in breakdown
      resourcesToTransfer.forEach((resource) => {
        const result = transferSingleResource(
          sourceNode,
          targetNode,
          resource,
          undefined, // No limit - transfer everything available
        );

        if (result) {
          // Track edge statistics
          const edgeStatKey = `${edge.id}-${resource}`;
          edgeStats.set(edgeStatKey, {
            transferred: result.amount,
            resource: resource,
          });

          // Track statistics
          trackStockpileChange(sourceStats.stockpileChanges, resource, {
            removed: result.amount,
            added: 0,
          });
          trackStockpileChange(targetStats.stockpileChanges, resource, {
            removed: 0,
            added: result.amount,
          });
        }
      });
    } else {
      // For specific resource edges, respect transfer amount
      resourcesToTransfer.forEach((resource) => {
        const result = transferSingleResource(
          sourceNode,
          targetNode,
          resource,
          transferAmount,
        );

        if (result) {
          // Track edge statistics
          edgeStats.set(edge.id, {
            transferred: result.amount,
            resource: resource,
          });

          // Track statistics
          trackStockpileChange(sourceStats.stockpileChanges, resource, {
            removed: result.amount,
            added: 0,
          });
          trackStockpileChange(targetStats.stockpileChanges, resource, {
            removed: 0,
            added: result.amount,
          });
        }
      });
    }
  });
};

/**
 * Helper to find available amount for a resource in stockpile.
 * Checks both direct stockpile and "any" stockpile breakdown.
 */
function findAvailableAmount(
  building: BuildingInstance,
  resource: ResourceType,
): { amount: number; isAny: boolean } {
  // Check direct stockpile first
  const directStock = building.stockpile?.find((s) => s.resource === resource);
  if (directStock && directStock.amount > 0) {
    return { amount: directStock.amount, isAny: false };
  }

  // Check "any" stockpile breakdown
  const anyStock = building.stockpile?.find((s) => s.resource === "any");
  if (anyStock?.breakdown?.has(resource)) {
    const amount = anyStock.breakdown.get(resource) || 0;
    return { amount, isAny: true };
  }

  return { amount: 0, isAny: false };
}

/**
 * Helper to find available space for a resource in stockpile.
 * Checks both direct stockpile and "any" stockpile.
 */
function findAvailableSpace(
  building: BuildingInstance,
  resource: ResourceType,
): { space: number; isAny: boolean } {
  // Check direct stockpile first
  const directStock = building.stockpile?.find((s) => s.resource === resource);
  if (directStock) {
    return {
      space: directStock.maxAmount - directStock.amount,
      isAny: false,
    };
  }

  // Check "any" stockpile
  const anyStock = building.stockpile?.find((s) => s.resource === "any");
  if (anyStock) {
    return {
      space: anyStock.maxAmount - anyStock.amount,
      isAny: true,
    };
  }

  return { space: 0, isAny: false };
}

/**
 * Transfer a single resource from source to target.
 * Returns the amount transferred or null if no transfer occurred.
 */
function transferSingleResource(
  sourceNode: Node,
  targetNode: Node,
  resource: ResourceType,
  maxTransferAmount?: number,
): { amount: number } | null {
  // ✅ Get fresh building data for accurate amounts
  const sourceBuilding = getBuildingInstance(sourceNode);
  const targetBuilding = getBuildingInstance(targetNode);

  if (!sourceBuilding || !targetBuilding) return null;

  const sourceInfo = findAvailableAmount(sourceBuilding, resource);
  const targetInfo = findAvailableSpace(targetBuilding, resource);

  if (sourceInfo.amount === 0 || targetInfo.space === 0) {
    return null;
  }

  const actualTransferAmount = Math.min(
    maxTransferAmount ?? sourceInfo.amount,
    sourceInfo.amount,
    targetInfo.space,
  );

  if (actualTransferAmount <= 0) {
    return null;
  }

  // Update source stockpile
  updateStockpile(
    sourceNode,
    sourceBuilding,
    resource,
    -actualTransferAmount,
    sourceInfo.isAny,
  );

  // Update target stockpile (get fresh target building after source update)
  const freshTargetBuilding = getBuildingInstance(targetNode);
  if (!freshTargetBuilding) return null;

  updateStockpile(
    targetNode,
    freshTargetBuilding,
    resource,
    actualTransferAmount,
    targetInfo.isAny,
  );

  return { amount: actualTransferAmount };
}

/**
 * Update a stockpile by adding/removing an amount.
 * Handles both direct stockpile and "any" stockpile breakdown.
 */
function updateStockpile(
  node: Node,
  building: BuildingInstance,
  resource: ResourceType,
  delta: number,
  isAny: boolean,
) {
  if (isAny) {
    // Update "any" stockpile breakdown
    const anyStock = building.stockpile?.find((s) => s.resource === "any");
    if (!anyStock) return;

    const breakdown = new Map(anyStock.breakdown || new Map());
    const currentAmount = breakdown.get(resource) || 0;
    const newAmount = currentAmount + delta;

    if (newAmount <= 0) {
      breakdown.delete(resource);
    } else {
      breakdown.set(resource, newAmount);
    }

    const updatedBuilding = {
      ...building,
      stockpile: building.stockpile?.map((s) =>
        s.resource === "any"
          ? {
              ...s,
              amount: s.amount + delta,
              breakdown,
            }
          : s,
      ),
    };

    node.data = {
      ...node.data,
      buildingInstance: updatedBuilding,
    };
  } else {
    // Update direct stockpile
    const updatedBuilding = {
      ...building,
      stockpile: building.stockpile?.map((s) =>
        s.resource === resource ? { ...s, amount: s.amount + delta } : s,
      ),
    };

    node.data = {
      ...node.data,
      buildingInstance: updatedBuilding,
    };
  }
}

/**
 * Track stockpile changes in statistics
 */
function trackStockpileChange(
  changes: StockpileChange[],
  resource: ResourceType,
  amounts: { removed: number; added: number },
) {
  const existing = changes.find((c) => c.resource === resource);

  if (existing) {
    existing.removed += amounts.removed;
    existing.added += amounts.added;
    existing.net = existing.added - existing.removed;
  } else {
    changes.push({
      resource,
      removed: amounts.removed,
      added: amounts.added,
      net: amounts.added - amounts.removed,
    });
  }
}
