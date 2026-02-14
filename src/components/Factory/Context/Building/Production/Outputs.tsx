import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { isGlobalResource, RESOURCES } from "../../../data/resources";
import type { ProductionMethod } from "../../../types/production";

interface ProductionOutputsProps {
  productionMethod: ProductionMethod;
}

export const ProductionOutputs = ({
  productionMethod,
}: ProductionOutputsProps) => {
  if (productionMethod?.outputs.length === 0) return null;

  return (
    <BlockStack gap="1">
      <Text size="xs" tone="subdued">
        Outputs:
      </Text>
      {productionMethod.outputs.map((output, idx) => {
        if (isGlobalResource(output.resource)) {
          return (
            <InlineStack key={idx} gap="2">
              <Text size="sm">
                {RESOURCES[output.resource].icon} {output.resource}
              </Text>
            </InlineStack>
          );
        }

        return (
          <InlineStack key={idx} gap="2">
            <Text size="sm">
              • {output.amount}x {output.resource}
            </Text>
            <Text size="xs" tone="subdued">
              ({RESOURCES.money.icon}{" "}
              {output.amount * RESOURCES[output.resource].value})
            </Text>
          </InlineStack>
        );
      })}
    </BlockStack>
  );
};
