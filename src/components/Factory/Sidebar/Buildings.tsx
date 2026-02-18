import { BlockStack } from "@/components/ui/layout";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

import { BUILDINGS } from "../data/buildings";
import BuildingItem from "./BuildingItem";

const Buildings = () => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Buildings</SidebarGroupLabel>
      <SidebarGroupContent className="[&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none">
        <BlockStack gap="1">
          {BUILDINGS.map((building) => (
            <BuildingItem key={building.id} building={building} />
          ))}
        </BlockStack>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default Buildings;
