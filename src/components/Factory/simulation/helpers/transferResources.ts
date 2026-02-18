import type { Edge, Node } from "@xyflow/react";

import { getBuildingInstance } from "../../types/buildings";
import { isResourceData, type ResourceType } from "../../types/resources";
import type {
  BuildingStatistics,
  EdgeStatistics,
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
    const resource = edge.data.type;

    if (!resource) return;

    // ✅ Find source stockpile - check both direct match and "any" with breakdown
    let sourceStock = sourceBuilding.stockpile?.find(
      (s) => s.resource === resource,
    );

    let sourceIsAny = false;
    const sourceAnyStock = sourceBuilding.stockpile?.find(
      (s) => s.resource === "any",
    );

    // If no direct match, check if source has "any" stockpile with this resource in breakdown
    if (sourceAnyStock?.breakdown?.has(resource)) {
      sourceStock = sourceAnyStock;
      sourceIsAny = true;
    }

    // ✅ Find target stockpile
    const targetStock = targetBuilding.stockpile?.find(
      (s) => s.resource === resource || s.resource === "any",
    );

    if (!sourceStock || !targetStock) return;

    // ✅ Calculate available amount from source
    let availableFromSource: number;
    if (sourceIsAny && sourceStock.breakdown) {
      // Source is "any" - get amount from breakdown
      availableFromSource = sourceStock.breakdown.get(resource) || 0;
    } else {
      // Source is specific resource
      availableFromSource = sourceStock.amount;
    }

    if (availableFromSource === 0) return;

    // Calculate transfer amount
    let actualTransferAmount: number;

    if (transferAmount !== undefined) {
      const availableSpaceInTarget = targetStock.maxAmount - targetStock.amount;
      actualTransferAmount = Math.min(
        transferAmount,
        availableFromSource,
        availableSpaceInTarget,
      );
    } else {
      // Original behavior: transfer all available
      const availableSpaceInTarget = targetStock.maxAmount - targetStock.amount;
      actualTransferAmount = Math.min(
        availableFromSource,
        availableSpaceInTarget,
      );
    }

    if (actualTransferAmount > 0) {
      // Track edge statistics
      edgeStats.set(edge.id, {
        transferred: actualTransferAmount,
        resource: resource,
      });

      // Track source stockpile change (removed)
      const sourceChange = sourceStats.stockpileChanges.find(
        (c) => c.resource === resource,
      );
      if (sourceChange) {
        sourceChange.removed += actualTransferAmount;
        sourceChange.net = sourceChange.added - sourceChange.removed;
      } else {
        sourceStats.stockpileChanges.push({
          resource: resource,
          removed: actualTransferAmount,
          added: 0,
          net: -actualTransferAmount,
        });
      }

      // Track target stockpile change (added)
      const targetChange = targetStats.stockpileChanges.find(
        (c) => c.resource === resource,
      );
      if (targetChange) {
        targetChange.added += actualTransferAmount;
        targetChange.net = targetChange.added - targetChange.removed;
      } else {
        targetStats.stockpileChanges.push({
          resource: resource,
          removed: 0,
          added: actualTransferAmount,
          net: actualTransferAmount,
        });
      }

      // ✅ Update source stockpile
      if (sourceIsAny && sourceStock.breakdown) {
        // Source is "any" - update breakdown
        const breakdown = new Map(sourceStock.breakdown);
        const currentAmount = breakdown.get(resource as ResourceType) || 0;
        const newAmount = currentAmount - actualTransferAmount;

        if (newAmount <= 0) {
          breakdown.delete(resource as ResourceType);
        } else {
          breakdown.set(resource as ResourceType, newAmount);
        }

        const updatedSourceBuilding = {
          ...sourceBuilding,
          stockpile: sourceBuilding.stockpile?.map((s) =>
            s.resource === "any"
              ? {
                  ...s,
                  amount: s.amount - actualTransferAmount,
                  breakdown,
                }
              : s,
          ),
        };

        sourceNode.data = {
          ...sourceNode.data,
          buildingInstance: updatedSourceBuilding,
        };
      } else {
        // Source is specific resource
        const updatedSourceBuilding = {
          ...sourceBuilding,
          stockpile: sourceBuilding.stockpile?.map((s) =>
            s.resource === resource
              ? { ...s, amount: s.amount - actualTransferAmount }
              : s,
          ),
        };

        sourceNode.data = {
          ...sourceNode.data,
          buildingInstance: updatedSourceBuilding,
        };
      }

      // ✅ Update target stockpile
      if (targetStock.resource === "any") {
        const breakdown = new Map(targetStock.breakdown || new Map());
        const currentAmount = breakdown.get(resource as ResourceType) || 0;
        breakdown.set(
          resource as ResourceType,
          currentAmount + actualTransferAmount,
        );

        const updatedTargetBuilding = {
          ...targetBuilding,
          stockpile: targetBuilding.stockpile?.map((s) =>
            s.resource === "any"
              ? {
                  ...s,
                  amount: s.amount + actualTransferAmount,
                  breakdown,
                }
              : s,
          ),
        };

        targetNode.data = {
          ...targetNode.data,
          buildingInstance: updatedTargetBuilding,
        };
      } else {
        // Regular stockpile transfer
        const updatedTargetBuilding = {
          ...targetBuilding,
          stockpile: targetBuilding.stockpile?.map((s) =>
            s.resource === resource
              ? { ...s, amount: s.amount + actualTransferAmount }
              : s,
          ),
        };

        targetNode.data = {
          ...targetNode.data,
          buildingInstance: updatedTargetBuilding,
        };
      }
    }
  });
};
