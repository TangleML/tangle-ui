import type { Node } from "@xyflow/react";

import { RESOURCE_VALUES } from "../../data/resources";
import { getBuildingData } from "../../types/buildings";

interface GlobalOutputs {
  coins: number;
  knowledge: number;
}

export const processGlobalOutputBuilding = (
  node: Node,
  globalOutputs: GlobalOutputs,
) => {
  const building = getBuildingData(node);

  if (!building) return;

  const method = building.productionMethod;

  if (!method?.globalOutputs) return;

  // Special handling for marketplace - calculate value of resources
  if (building.id === "marketplace") {
    const anyStock = building.stockpile?.find((s) => s.resource === "any");
    if (!anyStock?.breakdown || anyStock.breakdown.size === 0) return;

    let totalCoins = 0;

    // Calculate value of each resource type
    anyStock.breakdown.forEach((amount, resourceType) => {
      const resourceValue = RESOURCE_VALUES[resourceType] || 1;
      totalCoins += amount * resourceValue;
    });

    globalOutputs.coins += totalCoins;

    // Clear marketplace stockpile
    node.data = {
      ...building,
      stockpile: building.stockpile?.map((s) =>
        s.resource === "any" ? { ...s, amount: 0, breakdown: new Map() } : s,
      ),
      productionState: { progress: 0, isProducing: false },
    };
    return;
  }

  // Library and other global output buildings
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
    // Consume all possible inputs
    const updatedStockpile = building.stockpile?.map((stock) => {
      const input = method.inputs.find((i) => i.resource === stock.resource);
      if (input) {
        return { ...stock, amount: stock.amount - input.amount * cycles };
      }
      return stock;
    });

    // Add all global outputs
    method.globalOutputs.forEach((output) => {
      if (output.resource === "coins") {
        globalOutputs.coins += output.amount * cycles;
      } else if (output.resource === "knowledge") {
        globalOutputs.knowledge += output.amount * cycles;
      }
    });

    node.data = {
      ...building,
      stockpile: updatedStockpile,
      productionState: { progress: 0, isProducing: false },
    };
  }
};
