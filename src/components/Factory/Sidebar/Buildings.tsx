import { BlockStack } from "@/components/ui/layout";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

import { BUILDING_TYPES } from "../types/buildings";
import BuildingItem from "./BuildingItem";

const Buildings = () => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Buildings</SidebarGroupLabel>
      <SidebarGroupContent className="[&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none">
        <BlockStack gap="1">
          {BUILDING_TYPES.map((buildingType) => (
            <BuildingItem key={buildingType} buildingType={buildingType} />
          ))}
        </BlockStack>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default Buildings;
