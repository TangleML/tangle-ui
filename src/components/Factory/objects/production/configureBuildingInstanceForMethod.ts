import { Position } from "@xyflow/react";

import { isGlobalResource } from "../../data/resources";
import type {
  BuildingInput,
  BuildingInstance,
  BuildingOutput,
  Stockpile,
} from "../../types/buildings";
import type { ProductionMethod } from "../../types/production";
import type { ResourceType } from "../../types/resources";

const STOCKPILE_MULTIPLIER = 10;
const MAX_HANDLES_PER_SIDE = 3;

/**
 * Distributes handles in round-robin fashion across available sides
 */
function distributeHandlesRoundRobin(
  count: number,
  excludeSide?: Position,
): Position[] {
  const availableSides = [
    Position.Left,
    Position.Right,
    Position.Bottom,
    Position.Top,
  ].filter((side) => side !== excludeSide);

  const positions: Position[] = [];

  for (let i = 0; i < count; i++) {
    positions.push(availableSides[i % availableSides.length]);
  }

  return positions;
}

/**
 * Groups resources by type
 */
function groupResourcesByType<T extends { resource: ResourceType }>(
  items: T[],
): Map<ResourceType, T[]> {
  const groups = new Map<ResourceType, T[]>();

  items.forEach((item) => {
    const existing = groups.get(item.resource) || [];
    existing.push(item);
    groups.set(item.resource, existing);
  });

  return groups;
}

/**
 * Assigns positions to handles with proper spreading logic.
 *
 * Logic:
 * - If multiple different resource types: each type gets its own side
 * - If all same type but multiple handles: round-robin distribution
 * - Respects MAX_HANDLES_PER_SIDE constraint
 */
function assignHandlePositions(
  items: Array<{ resource: ResourceType }>,
  excludeSide?: Position,
): Position[] {
  if (items.length === 0) return [];

  if (items.length === 1) {
    // Single handle goes on default side (not excluded)
    const defaultSide =
      excludeSide === Position.Right ? Position.Left : Position.Right;
    return [defaultSide];
  }

  const groups = groupResourcesByType(items);

  // Strategy 1: Multiple different types - assign each type to a different side
  if (groups.size > 1) {
    const positions: Position[] = [];
    const availableSides = [
      Position.Left,
      Position.Right,
      Position.Bottom,
      Position.Top,
    ].filter((side) => side !== excludeSide);

    let sideIndex = 0;

    // Sort groups by size (larger groups first) for better distribution
    const sortedGroups = Array.from(groups.entries()).sort(
      (a, b) => b[1].length - a[1].length,
    );

    sortedGroups.forEach(([_, groupItems]) => {
      // Check if this group exceeds MAX_HANDLES_PER_SIDE
      if (groupItems.length > MAX_HANDLES_PER_SIDE) {
        // Split large groups across multiple sides
        let itemsPlaced = 0;

        while (itemsPlaced < groupItems.length) {
          const side = availableSides[sideIndex % availableSides.length];
          const itemsForThisSide = Math.min(
            MAX_HANDLES_PER_SIDE,
            groupItems.length - itemsPlaced,
          );

          for (let i = 0; i < itemsForThisSide; i++) {
            positions.push(side);
          }

          itemsPlaced += itemsForThisSide;
          sideIndex++;
        }
      } else {
        // Small group fits on one side
        const side = availableSides[sideIndex % availableSides.length];

        for (let i = 0; i < groupItems.length; i++) {
          positions.push(side);
        }

        sideIndex++;
      }
    });

    return positions;
  }

  // Strategy 2: All same type - distribute round-robin across all available sides
  // This respects MAX_HANDLES_PER_SIDE automatically since we cycle through sides
  return distributeHandlesRoundRobin(items.length, excludeSide);
}

interface ConfiguredBuildingData {
  inputs: BuildingInput[];
  outputs: BuildingOutput[];
  stockpile: Stockpile[];
  productionMethod: ProductionMethod;
  productionState: {
    progress: number;
    status: "idle" | "active" | "paused" | "complete";
  };
}

/**
 * Configures a building instance for a specific production method.
 */
export const configureBuildingInstanceForMethod = (
  productionMethod: ProductionMethod,
  existingBuilding?: BuildingInstance,
): ConfiguredBuildingData => {
  // Collect non-global inputs and outputs
  const nonGlobalInputs = productionMethod.inputs.filter(
    (input) => !isGlobalResource(input.resource),
  );

  const nonGlobalOutputs = productionMethod.outputs.filter(
    (output) => !isGlobalResource(output.resource),
  );

  // Expand inputs/outputs based on nodes count
  const expandedInputs = nonGlobalInputs.flatMap((input) =>
    Array(input.nodes ?? 1).fill({ resource: input.resource }),
  );

  const expandedOutputs = nonGlobalOutputs.flatMap((output) =>
    Array(output.nodes ?? 1).fill({ resource: output.resource }),
  );

  const totalInputHandles = expandedInputs.length;
  const totalOutputHandles = expandedOutputs.length;

  // Determine layout strategy
  let inputPositions: Position[];
  let outputPositions: Position[];

  if (totalInputHandles === 0 && totalOutputHandles > 0) {
    // No inputs, spread outputs across all sides (initially skipping the Left side)
    outputPositions = distributeHandlesRoundRobin(
      totalOutputHandles,
      totalOutputHandles < 4 ? Position.Left : undefined,
    );
    inputPositions = [];
  } else if (totalOutputHandles === 0 && totalInputHandles > 0) {
    // No outputs, spread inputs across all sides
    inputPositions = distributeHandlesRoundRobin(totalInputHandles);
    outputPositions = [];
  } else if (totalInputHandles > totalOutputHandles) {
    // More inputs than outputs: outputs on right, spread inputs
    outputPositions = expandedOutputs.map(() => Position.Right);
    inputPositions = assignHandlePositions(expandedInputs, Position.Right);
  } else if (totalOutputHandles > totalInputHandles) {
    // More outputs than inputs: inputs on left, spread outputs
    inputPositions = expandedInputs.map(() => Position.Left);
    outputPositions = assignHandlePositions(expandedOutputs, Position.Left);
  } else {
    // Equal counts: inputs on left, outputs on right
    inputPositions = expandedInputs.map(() => Position.Left);
    outputPositions = expandedOutputs.map(() => Position.Right);
  }

  // Generate inputs with assigned positions
  const inputs: BuildingInput[] = [];
  let inputPositionIndex = 0;

  nonGlobalInputs.forEach((input) => {
    const nodeCount = input.nodes ?? 1;

    for (let i = 0; i < nodeCount; i++) {
      inputs.push({
        resource: input.resource,
        position: inputPositions[inputPositionIndex++],
      });
    }
  });

  // Generate outputs with assigned positions
  const outputs: BuildingOutput[] = [];
  let outputPositionIndex = 0;

  nonGlobalOutputs.forEach((output) => {
    const nodeCount = output.nodes ?? 1;

    for (let i = 0; i < nodeCount; i++) {
      outputs.push({
        resource: output.resource,
        position: outputPositions[outputPositionIndex++],
      });
    }
  });

  // Generate stockpiles from production method
  const stockpile: Stockpile[] = [];
  const stockpileMap = new Map<ResourceType, number>();

  // Calculate required max amounts for each resource
  productionMethod.inputs.forEach((input) => {
    if (!stockpileMap.has(input.resource)) {
      stockpileMap.set(input.resource, input.amount * STOCKPILE_MULTIPLIER);
    }
  });

  productionMethod.outputs.forEach((output) => {
    if (isGlobalResource(output.resource)) return;

    if (!stockpileMap.has(output.resource)) {
      stockpileMap.set(output.resource, output.amount * STOCKPILE_MULTIPLIER);
    }
  });

  stockpileMap.forEach((maxAmount, resource) => {
    // Try to find existing stockpile to preserve amount
    const existingStockpile = existingBuilding?.stockpile?.find(
      (s) => s.resource === resource,
    );

    if (existingStockpile) {
      // Preserve existing amount (capped at new maxAmount)
      stockpile.push({
        resource,
        amount: Math.min(existingStockpile.amount, maxAmount),
        maxAmount,
        ...(resource === "any" && {
          breakdown: existingStockpile.breakdown || new Map(),
        }),
      });
    } else {
      // Create new stockpile
      stockpile.push({
        resource,
        amount: 0,
        maxAmount,
        ...(resource === "any" && { breakdown: new Map() }),
      });
    }
  });

  return {
    inputs,
    outputs,
    stockpile,
    productionMethod,
    productionState: {
      progress: 0,
      status: "idle",
    },
  };
};
