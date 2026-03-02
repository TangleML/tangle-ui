import type { Node } from "@xyflow/react";

import { RESOURCE_VALUES, RESOURCES } from "../../data/resources";
import { getBuildingData } from "../../types/buildings";
import type { BuildingStatistics } from "../../types/statistics";

export const processGlobalOutputBuilding = (
  node: Node,
  globalOutputs: Record<string, number>,
  buildingStats: Map<string, BuildingStatistics>,
) => {
  const building = getBuildingData(node);

  if (!building) return;

  const method = building.productionMethod;
  if (!method) return;

  // Check if this building produces any global outputs
  const hasGlobalOutputs = method.outputs.some(
    (output) => RESOURCES[output.resource]?.global,
  );

  if (!hasGlobalOutputs) return;

  // Initialize statistics for this building
  if (!buildingStats.has(node.id)) {
    buildingStats.set(node.id, { stockpileChanges: [], produced: {} });
  }
  const stats = buildingStats.get(node.id)!;

  // Special handling for marketplace - calculate value of resources
  if (building.id === "marketplace") {
    const anyStock = building.stockpile?.find((s) => s.resource === "any");

    if (!anyStock?.breakdown || anyStock.breakdown.size === 0) {
      node.data = {
        ...building,
        productionState: { progress: 0, status: "idle" },
      };
      return;
    }

    let totalMoney = 0;

    // Calculate value of each resource type and track changes
    anyStock.breakdown.forEach((amount, resourceType) => {
      const resourceValue = RESOURCE_VALUES[resourceType] || 1;
      totalMoney += amount * resourceValue;

      // Track that these resources were consumed
      const change = stats.stockpileChanges.find(
        (c) => c.resource === resourceType,
      );
      if (change) {
        change.removed += amount;
        change.net = change.added - change.removed;
      } else {
        stats.stockpileChanges.push({
          resource: resourceType,
          removed: amount,
          added: 0,
          net: -amount,
        });
      }
    });

    // Add to global outputs dynamically
    globalOutputs.money = (globalOutputs.money || 0) + totalMoney;
    stats.produced = { money: totalMoney };

    // Clear marketplace stockpile
    node.data = {
      ...building,
      stockpile: building.stockpile?.map((s) =>
        s.resource === "any" ? { ...s, amount: 0, breakdown: new Map() } : s,
      ),
      productionState: { progress: 1, status: "complete" },
    };
    return;
  }

  // Generic handling for all other global output buildings (library, etc.)
  let cycles = Infinity;
  method.inputs.forEach((input) => {
    const stock = building.stockpile?.find(
      (s) => s.resource === input.resource,
    );
    if (stock) {
      const possibleCycles = Math.floor(stock.amount / input.amount);
      cycles = Math.min(cycles, possibleCycles);
    } else {
      cycles = 0;
    }
  });

  if (cycles > 0 && cycles !== Infinity) {
    // Consume all possible inputs and track changes
    const updatedStockpile = building.stockpile?.map((stock) => {
      const input = method.inputs.find((i) => i.resource === stock.resource);
      if (input) {
        const consumed = input.amount * cycles;

        // Track stockpile changes
        const change = stats.stockpileChanges.find(
          (c) => c.resource === stock.resource,
        );
        if (change) {
          change.removed += consumed;
          change.net = change.added - change.removed;
        } else {
          stats.stockpileChanges.push({
            resource: stock.resource,
            removed: consumed,
            added: 0,
            net: -consumed,
          });
        }

        return { ...stock, amount: stock.amount - consumed };
      }
      return stock;
    });

    // Add all outputs (filter for global ones)
    const produced: Record<string, number> = {};

    method.outputs.forEach((output) => {
      const isGlobal = RESOURCES[output.resource]?.global;

      if (isGlobal) {
        const amount = output.amount * cycles;
        globalOutputs[output.resource] =
          (globalOutputs[output.resource] || 0) + amount;
        produced[output.resource] = amount;
      }
    });

    stats.produced = produced;

    node.data = {
      ...building,
      stockpile: updatedStockpile,
      productionState: { progress: 0, status: "idle" },
    };
  }
};
