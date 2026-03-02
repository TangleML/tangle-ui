import type { Edge, Node } from "@xyflow/react";

import { getBuildingData } from "../../types/buildings";
import type {
  BuildingStatistics,
  EdgeStatistics,
} from "../../types/statistics";
import { extractResource } from "../../utils/string";

export const transferResources = (
  sourceNodeId: string,
  targetNodeId: string,
  updatedNodes: Node[],
  edges: Edge[],
  buildingStats: Map<string, BuildingStatistics>,
  edgeStats: Map<string, EdgeStatistics>,
) => {
  const sourceNode = updatedNodes.find((n) => n.id === sourceNodeId);
  const targetNode = updatedNodes.find((n) => n.id === targetNodeId);

  if (!sourceNode || !targetNode) return;

  const sourceBuilding = getBuildingData(sourceNode);
  const targetBuilding = getBuildingData(targetNode);

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
    // Extract resource from edge handle
    const resource =
      extractResource(edge.sourceHandle) || extractResource(edge.targetHandle);
    if (!resource) return;

    // Find stockpiles
    const sourceStock = sourceBuilding.stockpile?.find(
      (s) => s.resource === resource,
    );
    const targetStock = targetBuilding.stockpile?.find(
      (s) => s.resource === resource || s.resource === "any",
    );

    if (!sourceStock || !targetStock) return;

    // Calculate transfer amount - limited by both source amount AND target space
    const availableFromSource = sourceStock.amount;
    const availableSpaceInTarget = targetStock.maxAmount - targetStock.amount;
    const transferAmount = Math.min(
      availableFromSource,
      availableSpaceInTarget,
    );

    if (transferAmount > 0) {
      // Track edge statistics
      edgeStats.set(edge.id, {
        transferred: transferAmount,
        resource: resource as any,
      });

      // Track source stockpile change (removed)
      const sourceChange = sourceStats.stockpileChanges.find(
        (c) => c.resource === resource,
      );
      if (sourceChange) {
        sourceChange.removed += transferAmount;
        sourceChange.net = sourceChange.added - sourceChange.removed;
      } else {
        sourceStats.stockpileChanges.push({
          resource: resource as any,
          removed: transferAmount,
          added: 0,
          net: -transferAmount,
        });
      }

      // Track target stockpile change (added)
      const targetChange = targetStats.stockpileChanges.find(
        (c) => c.resource === resource,
      );
      if (targetChange) {
        targetChange.added += transferAmount;
        targetChange.net = targetChange.added - targetChange.removed;
      } else {
        targetStats.stockpileChanges.push({
          resource: resource as any,
          removed: 0,
          added: transferAmount,
          net: transferAmount,
        });
      }

      // Update source stockpile
      sourceNode.data = {
        ...sourceBuilding,
        stockpile: sourceBuilding.stockpile?.map((s) =>
          s.resource === resource
            ? { ...s, amount: s.amount - transferAmount }
            : s,
        ),
      };

      // Update target stockpile
      if (targetStock.resource === "any") {
        // For "any" stockpiles, track the specific resource in breakdown
        const breakdown = targetStock.breakdown || new Map();
        const currentAmount = breakdown.get(resource) || 0;
        breakdown.set(resource, currentAmount + transferAmount);

        targetNode.data = {
          ...targetBuilding,
          stockpile: targetBuilding.stockpile?.map((s) =>
            s.resource === "any"
              ? {
                  ...s,
                  amount: s.amount + transferAmount,
                  breakdown: new Map(breakdown),
                }
              : s,
          ),
        };
      } else {
        // Regular stockpile transfer
        targetNode.data = {
          ...targetBuilding,
          stockpile: targetBuilding.stockpile?.map((s) =>
            s.resource === resource
              ? { ...s, amount: s.amount + transferAmount }
              : s,
          ),
        };
      }
    }
  });
};
