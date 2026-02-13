import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { BUILDING_TYPES } from "../types/buildings";
import BuildingItem from "./BuildingItem";

const Buildings = () => {
  return (
    <BlockStack gap="2">
      <Text>Buildings</Text>
      <BlockStack gap="1">
        {BUILDING_TYPES.map((buildingType) => (
          <BuildingItem key={buildingType} buildingType={buildingType} />
        ))}
      </BlockStack>
    </BlockStack>
  );
};

export default Buildings;
