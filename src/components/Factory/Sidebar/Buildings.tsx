import { BlockStack } from "@/components/ui/layout";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

import { BUILDING_TYPES, BUILDINGS } from "../data/buildings";
import {
  BUILDING_CATEGORIES,
  type BuildingCategory,
  type BuildingType,
} from "../types/buildings";
import BuildingFolder from "./BuildingFolder";

const Buildings = () => {
  // Group buildings by category
  const buildingsByCategory = getBuildingsByCategory();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Buildings</SidebarGroupLabel>
      <SidebarGroupContent className="[&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none">
        <BlockStack gap="2">
          {BUILDING_CATEGORIES.map((category) => {
            const buildings = buildingsByCategory.get(category.type) || [];

            if (buildings.length === 0) return null;

            return (
              <BuildingFolder
                key={category.type}
                category={category.type}
                buildings={buildings}
              />
            );
          })}
        </BlockStack>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default Buildings;

function getBuildingsByCategory() {
  const grouped = new Map<BuildingCategory, BuildingType[]>();

  BUILDING_CATEGORIES.forEach((category) => {
    grouped.set(category.type, []);
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
