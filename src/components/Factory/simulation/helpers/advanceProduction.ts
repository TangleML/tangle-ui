import type { Node } from "@xyflow/react";

import { type GlobalResources, isGlobalResource } from "../../data/resources";
import { getBuildingInstance } from "../../types/buildings";
import type { ResourceType } from "../../types/resources";
import type { BuildingStatistics } from "../../types/statistics";

export const advanceProduction = (
  node: Node,
  earnedGlobalResources: GlobalResources,
  buildingStats: Map<string, BuildingStatistics>,
) => {
  const building = getBuildingInstance(node);
  if (!building) return;

  const method = building.productionMethod;
  if (!method) return;

  // Initialize statistics for this building if needed
  if (!buildingStats.has(node.id)) {
    buildingStats.set(node.id, { stockpileChanges: [], produced: {} });
  }
  const stats = buildingStats.get(node.id)!;

  // Initialize production state if not present (default to idle)
  let productionState = building.productionState || {
    progress: 0,
    status: "idle" as const,
  };

  let stockpile = building.stockpile || [];

  // Helper to track stockpile changes
  const trackChange = (
    resource: ResourceType,
    added: number,
    removed: number,
  ) => {
    const existing = stats.stockpileChanges.find(
      (c) => c.resource === resource,
    );
    if (existing) {
      existing.added += added;
      existing.removed += removed;
      existing.net = existing.added - existing.removed;
    } else {
      stats.stockpileChanges.push({
        resource,
        added,
        removed,
        net: added - removed,
      });
    }
  };

  // Helper: Check if building has enough inputs
  const hasEnoughInputs = (): boolean => {
    if (method.inputs.length === 0) return true; // No inputs needed

    return method.inputs.every((input) => {
      const stock = stockpile?.find(
        (s) => s.resource === input.resource || s.resource === "any",
      );
      return stock && stock.amount >= input.amount;
    });
  };

  // Helper: Check if there's room in output stockpile (only for non-global outputs)
  const hasOutputSpace = (): boolean => {
    if (!method.outputs || method.outputs.length === 0) return true;

    return method.outputs.every((output) => {
      // Global outputs don't need stockpile space
      if (isGlobalResource(output.resource)) return true;

      const stock = stockpile?.find((s) => s.resource === output.resource);
      // If no stockpile exists for this output, we can't produce it
      if (!stock) return false;
      return stock.amount + output.amount <= stock.maxAmount;
    });
  };

  // Helper: Consume input resources from stockpile
  const consumeInputs = () => {
    if (method.inputs.length === 0) return; // No inputs to consume

    stockpile = stockpile?.map((stock) => {
      const input = method.inputs.find(
        (i) =>
          i.resource === stock.resource ||
          (stock.resource === "any" && i.resource === "any"),
      );
      if (input) {
        trackChange(stock.resource, 0, input.amount);
        return { ...stock, amount: stock.amount - input.amount };
      }
      return stock;
    });
  };

  // Helper: Add output resources to stockpile or global outputs
  const addOutputs = () => {
    const produced: Partial<Record<ResourceType, number>> = {};

    method.outputs?.forEach((output) => {
      const { resource } = output;

      if (isGlobalResource(resource)) {
        // Add to global outputs
        earnedGlobalResources[resource] =
          (earnedGlobalResources[resource] || 0) + output.amount;
      } else {
        // Add to stockpile
        stockpile = stockpile?.map((stock) => {
          if (stock.resource === output.resource) {
            trackChange(stock.resource, output.amount, 0);
            return {
              ...stock,
              amount: Math.min(stock.maxAmount, stock.amount + output.amount),
            };
          }
          return stock;
        });
      }

      produced[resource] = output.amount;
    });

    // Track production in stats
    if (Object.keys(produced).length > 0) {
      stats.produced = produced;
    }
  };

  // Step 1: If complete, reset & transition to idle
  if (productionState.status === "complete") {
    productionState = {
      progress: 0,
      status: "idle",
    };
  }

  // Step 2: If idle, try to start production
  if (productionState.status === "idle") {
    if (hasEnoughInputs() && hasOutputSpace()) {
      consumeInputs();
      productionState = {
        progress: 0,
        status: "active",
      };
    }
  }

  // Step 3: If paused, check if we can resume
  if (productionState.status === "paused") {
    if (hasOutputSpace()) {
      productionState = {
        progress: productionState.progress,
        status: "active",
      };
    }
  }

  // Step 4: If active, advance progress or pause
  if (productionState.status === "active") {
    if (!hasOutputSpace()) {
      // Pause production - no room in output
      productionState = {
        progress: productionState.progress,
        status: "paused",
      };
    } else {
      // Advance progress
      const newProgress = productionState.progress + 1;

      // Step 5: Check if production is complete
      if (newProgress >= method.days) {
        addOutputs();
        productionState = {
          progress: newProgress,
          status: "complete",
        };
      } else {
        // Continue producing
        productionState = {
          progress: newProgress,
          status: "active",
        };
      }
    }
  }

  // Update node with final state
  node.data.buildingInstance = {
    ...building,
    stockpile,
    productionState,
  };
};
