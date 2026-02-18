import type { Node } from "@xyflow/react";

import {
  getResourceTypeFoodValue,
  type GlobalResources,
  isFoodProducingResourceType,
  RESOURCE_VALUES,
} from "../../data/resources";
import { getBuildingInstance } from "../../types/buildings";
import type { BuildingStatistics } from "../../types/statistics";

/**
 * Handles special building logic that doesn't follow standard production cycles
 * Currently handles: Marketplace (sells any resources for money)
 */
export const processSpecialBuilding = (
  node: Node,
  earnedGlobalResources: GlobalResources,
  buildingStats: Map<string, BuildingStatistics>,
) => {
  const building = getBuildingInstance(node);
  if (!building) return;

  // Initialize statistics for this building
  if (!buildingStats.has(node.id)) {
    buildingStats.set(node.id, { stockpileChanges: [], produced: {} });
  }
  const stats = buildingStats.get(node.id)!;

  // Marketplace: Sells any resources for money based on their value
  if (building.type === "marketplace") {
    const anyStock = building.stockpile?.find((s) => s.resource === "any");

    // If no stockpile or empty, set to idle
    if (
      !anyStock ||
      anyStock.amount === 0 ||
      !anyStock.breakdown ||
      anyStock.breakdown.size === 0
    ) {
      node.data = {
        ...node.data,
        buildingInstance: {
          ...building,
          productionState: { progress: 0, status: "idle" },
        },
      };
      return;
    }

    let totalMoney = 0;

    // Sell each resource type for its value
    anyStock.breakdown.forEach((amount, resourceType) => {
      if (amount > 0) {
        // Get the base value of the resource
        const resourceValue = RESOURCE_VALUES[resourceType] || 1;

        // The marketplace production method has a money multiplier on the output
        // Get the money multiplier from the production method
        const moneyOutput = building.productionMethod.outputs?.find(
          (o) => o.resource === "money",
        );
        const moneyMultiplier = moneyOutput?.amount || 1;

        // Calculate total money: resource_value * amount * money_multiplier
        const moneyForThisResource = amount * resourceValue * moneyMultiplier;
        totalMoney += moneyForThisResource;

        // Track that these resources were consumed (sold)
        const change = stats.stockpileChanges.find(
          (c) => c.resource === resourceType,
        );
        if (change) {
          change.removed += amount;
          change.net = change.added - change.removed;
        } else {
          stats.stockpileChanges.push({
            resource: resourceType as any,
            removed: amount,
            added: 0,
            net: -amount,
          });
        }
      }
    });

    // Add money to global outputs
    if (totalMoney > 0) {
      earnedGlobalResources.money =
        (earnedGlobalResources.money || 0) + totalMoney;

      // Track produced money in statistics
      if (!stats.produced) {
        stats.produced = {};
      }
      stats.produced.money = (stats.produced.money || 0) + totalMoney;
    }

    // Clear marketplace stockpile completely - both amount AND breakdown
    const updatedBuilding = {
      ...building,
      stockpile: building.stockpile?.map((s) =>
        s.resource === "any"
          ? {
              ...s,
              amount: 0,
              breakdown: new Map(),
            }
          : s,
      ),
      productionState: { progress: 1, status: "complete" as const },
    };

    node.data = {
      ...node.data,
      buildingInstance: updatedBuilding,
    };
  }

  // Firepit & Granary: Converts resources with food value into food (and for fire pit, also knowledge)
  if (building.type === "firepit" || building.type === "granary") {
    if (!building.stockpile || building.stockpile.length === 0) {
      node.data = {
        ...node.data,
        buildingInstance: {
          ...building,
          productionState: { progress: 0, status: "idle" },
        },
      };
      return;
    }

    let totalFood = 0;
    const updatedStockpile = building.stockpile.map((stock) => {
      // Only process food-producing resources
      if (isFoodProducingResourceType(stock.resource) && stock.amount > 0) {
        const foodValue = getResourceTypeFoodValue(stock.resource);
        const foodForThisResource = stock.amount * foodValue;
        totalFood += foodForThisResource;

        // Track that these resources were consumed
        const change = stats.stockpileChanges.find(
          (c) => c.resource === stock.resource,
        );
        if (change) {
          change.removed += stock.amount;
          change.net = change.added - change.removed;
        } else {
          stats.stockpileChanges.push({
            resource: stock.resource,
            removed: stock.amount,
            added: 0,
            net: -stock.amount,
          });
        }

        // Clear this stockpile
        return {
          ...stock,
          amount: 0,
        };
      }

      return stock;
    });

    // Add food and knowledge to global outputs
    if (totalFood > 0) {
      earnedGlobalResources.food =
        (earnedGlobalResources.food || 0) + totalFood;

      // Track produced food in statistics
      if (!stats.produced) {
        stats.produced = {};
      }
      stats.produced.food = (stats.produced.food || 0) + totalFood;

      // Also produce 1 knowledge when food is produced
      if (building.type === "firepit") {
        earnedGlobalResources.knowledge =
          (earnedGlobalResources.knowledge || 0) + 1;
        stats.produced.knowledge = (stats.produced.knowledge || 0) + 1;
      }
    }

    const updatedBuilding = {
      ...building,
      stockpile: updatedStockpile,
      productionState: {
        progress: totalFood > 0 ? 1 : 0,
        status: totalFood > 0 ? ("complete" as const) : ("idle" as const),
      },
    };

    node.data = {
      ...node.data,
      buildingInstance: updatedBuilding,
    };
  }
};
