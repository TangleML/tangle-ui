import { BlockStack } from "@/components/ui/layout";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

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
    <SidebarGroup>
      <SidebarGroupLabel>Buildings</SidebarGroupLabel>
      <SidebarGroupContent className="[&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none">
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
      </SidebarGroupContent>
    </SidebarGroup>
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
