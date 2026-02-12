import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { BUILDINGS } from "../data/buildings";
import BuildingItem from "./BuildingItem";

const Buildings = () => {
  return (
    <BlockStack gap="2">
      <Text>Buildings</Text>
      <BlockStack gap="1">
        {BUILDINGS.map((building) => (
          <BuildingItem key={building.id} building={building} />
        ))}
      </BlockStack>
    </BlockStack>
  );
};

export default Buildings;
