import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { BUILDINGS } from "../data/buildings";
import type { BuildingCategory, BuildingType } from "../types/buildings";
import { BUILDING_TYPES } from "../types/buildings";
import BuildingFolder from "./BuildingFolder";

const CATEGORY_ORDER: BuildingCategory[] = [
  "special",
  "production",
  "refining",
  "utility",
  "storage",
];

const Buildings = () => {
  // Group buildings by category
  const buildingsByCategory = getBuildingsByCategory();

  return (
    <BlockStack gap="2">
      <Text>Buildings</Text>
      <BlockStack gap="2">
        {CATEGORY_ORDER.map((category) => {
          const buildings = buildingsByCategory.get(category) || [];

          if (buildings.length === 0) return null;

          return (
            <BuildingFolder
              key={category}
              category={category}
              buildings={buildings}
            />
          );
        })}
      </BlockStack>
    </BlockStack>
  );
};

export default Buildings;

function getBuildingsByCategory() {
  const grouped = new Map<BuildingCategory, BuildingType[]>();

  CATEGORY_ORDER.forEach((category) => {
    grouped.set(category, []);
  });

  BUILDING_TYPES.forEach((buildingType) => {
    const building = BUILDINGS[buildingType];
    const category = building.category;

    if (!grouped.has(category)) {
      grouped.set(category, []);
    }

    grouped.get(category)!.push(buildingType);
  });

  return grouped;
}
