import { getBuildingDefinition } from "../../data/buildings";
import {
  type BuildingInstance,
  type BuildingType,
} from "../../types/buildings";
import { configureBuildingInstanceForMethod } from "../production/configureBuildingInstanceForMethod";

/**
 * Creates a runtime building instance from a building definition
 * @param buildingType - The building type
 * @param productionMethodIndex - Which production method to use (default: 0)
 */
export function createBuildingInstance(
  buildingType: BuildingType,
  productionMethodIndex: number = 0,
): BuildingInstance {
  const building = getBuildingDefinition(buildingType);

  const productionMethod = building.productionMethods[productionMethodIndex];

  if (!productionMethod) {
    throw new Error(
      `No production method at index ${productionMethodIndex} for building ${buildingType}`,
    );
  }

  const id = `${buildingType}-${crypto.randomUUID()}`;

  const configuration = configureBuildingInstanceForMethod(productionMethod);

  return {
    id,
    type: buildingType,
    name: building.name,
    icon: building.icon,
    description: building.description,
    cost: building.cost,
    color: building.color,
    category: building.category,
    ...configuration,
  };
}
