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

/**
 * Distributes handles evenly across all four sides
 */
function distributeHandlesAcrossSides(count: number): Position[] {
  const positions: Position[] = [];
  const sides = [Position.Left, Position.Right, Position.Bottom, Position.Top];

  for (let i = 0; i < count; i++) {
    positions.push(sides[i % 4]);
  }

  return positions;
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
 * Can be used both for creating new buildings and updating existing ones.
 *
 * @param productionMethod - The production method to configure for
 * @param existingBuilding - Optional existing building to preserve values from
 * @returns Configuration object that can be merged into a building instance
 */
export const configureBuildingInstanceForMethod = (
  productionMethod: ProductionMethod,
  existingBuilding?: BuildingInstance,
): ConfiguredBuildingData => {
  // Check if we have any non-global outputs
  const hasNonGlobalOutputs = productionMethod.outputs.some(
    (output) => !isGlobalResource(output.resource),
  );

  // Check if we have any non-global inputs
  const hasNonGlobalInputs = productionMethod.inputs.some(
    (input) => !isGlobalResource(input.resource),
  );

  // Generate inputs from production method
  const inputs: BuildingInput[] = [];

  productionMethod.inputs.forEach((input) => {
    // Skip global resources - they don't need physical inputs
    if (isGlobalResource(input.resource)) return;

    const nodeCount = input.nodes ?? 1;

    // If building exists, try to find existing inputs with this resource to preserve positions
    const existingInputsForResource =
      existingBuilding?.inputs?.filter((i) => i.resource === input.resource) ||
      [];

    // If we have existing inputs for this resource, preserve their positions
    if (existingInputsForResource.length > 0) {
      existingInputsForResource.slice(0, nodeCount).forEach((existingInput) => {
        inputs.push({
          resource: input.resource,
          position: existingInput.position,
        });
      });

      // If we need more inputs than we had before, create new ones
      const remaining = nodeCount - existingInputsForResource.length;
      if (remaining > 0) {
        const shouldSpread = !hasNonGlobalOutputs;
        if (shouldSpread) {
          const positions = distributeHandlesAcrossSides(remaining);
          positions.forEach((position) => {
            inputs.push({
              resource: input.resource,
              position,
            });
          });
        } else {
          for (let i = 0; i < remaining; i++) {
            inputs.push({
              resource: input.resource,
              position: Position.Left,
            });
          }
        }
      }
    } else {
      // No existing inputs, create new ones
      const shouldSpread = !hasNonGlobalOutputs;

      if (shouldSpread && nodeCount > 1) {
        const positions = distributeHandlesAcrossSides(nodeCount);
        positions.forEach((position) => {
          inputs.push({
            resource: input.resource,
            position,
          });
        });
      } else {
        for (let i = 0; i < nodeCount; i++) {
          inputs.push({
            resource: input.resource,
            position: Position.Left,
          });
        }
      }
    }
  });

  // Generate outputs from production method
  const outputs: BuildingOutput[] = [];

  productionMethod.outputs.forEach((output) => {
    // Skip global resources - they don't need physical outputs
    if (isGlobalResource(output.resource)) return;

    const nodeCount = output.nodes ?? 1;

    // If building exists, try to find existing outputs with this resource to preserve positions
    const existingOutputsForResource =
      existingBuilding?.outputs?.filter(
        (o) => o.resource === output.resource,
      ) || [];

    // If we have existing outputs for this resource, preserve their positions
    if (existingOutputsForResource.length > 0) {
      existingOutputsForResource
        .slice(0, nodeCount)
        .forEach((existingOutput) => {
          outputs.push({
            resource: output.resource,
            position: existingOutput.position,
          });
        });

      // If we need more outputs than we had before, create new ones
      const remaining = nodeCount - existingOutputsForResource.length;
      if (remaining > 0) {
        const shouldSpread = !hasNonGlobalInputs;
        if (shouldSpread) {
          const positions = distributeHandlesAcrossSides(remaining);
          positions.forEach((position) => {
            outputs.push({
              resource: output.resource,
              position,
            });
          });
        } else {
          for (let i = 0; i < remaining; i++) {
            outputs.push({
              resource: output.resource,
              position: Position.Right,
            });
          }
        }
      }
    } else {
      // No existing outputs, create new ones
      const shouldSpread = !hasNonGlobalInputs;

      if (shouldSpread && nodeCount > 1) {
        const positions = distributeHandlesAcrossSides(nodeCount);
        positions.forEach((position) => {
          outputs.push({
            resource: output.resource,
            position,
          });
        });
      } else {
        for (let i = 0; i < nodeCount; i++) {
          outputs.push({
            resource: output.resource,
            position: Position.Right,
          });
        }
      }
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
