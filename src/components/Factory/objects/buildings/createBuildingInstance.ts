import { Position } from "@xyflow/react";

import { isGlobalResource } from "../../data/resources";
import {
  type BuildingInput,
  type BuildingInstance,
  type BuildingOutput,
  type BuildingType,
  getBuildingType,
  type Stockpile,
} from "../../types/buildings";
import type { ResourceType } from "../../types/resources";

const STOCKPILE_MULTIPLIER = 10;

/**
 * Distributes handles evenly across all four sides
 */
function distributeHandlesAcrossSides(count: number): Position[] {
  const positions: Position[] = [];
  const sides = [Position.Left, Position.Top, Position.Right, Position.Bottom];

  for (let i = 0; i < count; i++) {
    positions.push(sides[i % 4]);
  }

  return positions;
}

/**
 * Creates a runtime building instance from a building definition
 * @param building - The building template
 * @param productionMethodIndex - Which production method to use (default: 0)
 */
export function createBuildingInstance(
  buildingType: BuildingType,
  productionMethodIndex: number = 0,
): BuildingInstance {
  const building = getBuildingType(buildingType);

  const productionMethod = building.productionMethods[productionMethodIndex];

  if (!productionMethod) {
    throw new Error(
      `No production method at index ${productionMethodIndex} for building ${buildingType}`,
    );
  }

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

    // If no outputs exist (or all are global), spread inputs across all sides
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
      // Put all inputs on the same side (left)
      for (let i = 0; i < nodeCount; i++) {
        inputs.push({
          resource: input.resource,
          position: Position.Left,
        });
      }
    }
  });

  // Generate outputs from production method
  const outputs: BuildingOutput[] = [];

  productionMethod.outputs.forEach((output) => {
    // Skip global resources - they don't need physical outputs
    if (isGlobalResource(output.resource)) return;

    const nodeCount = output.nodes ?? 1;

    // If no inputs exist (or all are global), spread outputs across all sides
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
      // Put all outputs on the same side (right)
      for (let i = 0; i < nodeCount; i++) {
        outputs.push({
          resource: output.resource,
          position: Position.Right,
        });
      }
    }
  });

  // Generate stockpiles from production method
  const stockpile: Stockpile[] = [];
  const stockpileMap = new Map<ResourceType, number>();

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
    stockpile.push({
      resource,
      amount: 0,
      maxAmount,
      ...(resource === "any" && { breakdown: new Map() }),
    });
  });

  const id = `${buildingType}-${crypto.randomUUID()}`;

  return {
    id,
    type: buildingType,
    name: building.name,
    icon: building.icon,
    description: building.description,
    cost: building.cost,
    color: building.color,
    inputs,
    outputs,
    stockpile,
    productionMethod,
    productionState: {
      progress: 0,
      status: "idle",
    },
  };
}
