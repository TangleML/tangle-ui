import type { Node } from "@xyflow/react";

import { RESOURCES } from "../../data/resources";
import { getBuildingData } from "../../types/buildings";
import type { BuildingStatistics } from "../../types/statistics";

export const advanceProduction = (
  node: Node,
  buildingStats: Map<string, BuildingStatistics>,
) => {
  const building = getBuildingData(node);
  if (!building) return;

  const method = building.productionMethod;

  // Skip global output buildings - check dynamically if any output is global
  if (!method) return;

  const hasGlobalOutputs = method.outputs?.some(
    (output) => RESOURCES[output.resource]?.global,
  );

  if (hasGlobalOutputs) return; // Handled by processGlobalOutputBuilding

  // Initialize statistics for this building if needed
  if (!buildingStats.has(node.id)) {
    buildingStats.set(node.id, { stockpileChanges: [] });
  }
  const stats = buildingStats.get(node.id)!;

  // Initialize production state if not present (default to idle)
  let productionState = building.productionState || {
    progress: 0,
    status: "idle" as const,
  };

  let stockpile = building.stockpile;

  // Helper to track stockpile changes
  const trackChange = (resource: string, added: number, removed: number) => {
    const existing = stats.stockpileChanges.find(
      (c) => c.resource === resource,
    );
    if (existing) {
      existing.added += added;
      existing.removed += removed;
      existing.net = existing.added - existing.removed;
    } else {
      stats.stockpileChanges.push({
        resource: resource as any,
        added,
        removed,
        net: added - removed,
      });
    }
  };

  // Helper: Check if building has enough inputs
  const hasEnoughInputs = (): boolean => {
    return method.inputs.every((input) => {
      const stock = stockpile?.find(
        (s) => s.resource === input.resource || s.resource === "any",
      );
      return stock && stock.amount >= input.amount;
    });
  };

  // Helper: Check if there's room in output stockpile
  const hasOutputSpace = (): boolean => {
    if (!method.outputs || method.outputs.length === 0) return true;

    return method.outputs.every((output) => {
      const stock = stockpile?.find((s) => s.resource === output.resource);
      return stock && stock.amount + output.amount <= stock.maxAmount;
    });
  };

  // Helper: Consume input resources from stockpile
  const consumeInputs = () => {
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

  // Helper: Add output resources to stockpile
  const addOutputs = () => {
    stockpile = stockpile?.map((stock) => {
      const output = method.outputs?.find((o) => o.resource === stock.resource);
      if (output) {
        trackChange(stock.resource, output.amount, 0);
        return {
          ...stock,
          amount: Math.min(stock.maxAmount, stock.amount + output.amount),
        };
      }
      return stock;
    });
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
  node.data = {
    ...building,
    stockpile,
    productionState,
  };
};
