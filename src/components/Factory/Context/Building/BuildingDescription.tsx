import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { RESOURCES } from "../../data/resources";

interface BuildingDescriptionProps {
  description: string;
  cost?: number;
  maintenance?: number;
}

export const BuildingDescription = ({
  description,
  cost,
  maintenance,
}: BuildingDescriptionProps) => {
  return (
    <BlockStack gap="2">
      <Text size="sm" tone="subdued">
        {description}
      </Text>

      {cost !== undefined && (
        <InlineStack gap="2" align="center">
          {RESOURCES.money.icon}
          <Text size="sm">Cost: {cost}</Text>
        </InlineStack>
      )}

      {maintenance !== undefined && maintenance > 0 && (
        <InlineStack gap="2" align="center">
          {RESOURCES.money.icon}
          <Text size="sm">Maintenance: {maintenance}/day</Text>
        </InlineStack>
      )}
    </BlockStack>
  );
};
