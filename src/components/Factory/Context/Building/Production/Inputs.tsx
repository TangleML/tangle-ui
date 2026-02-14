import { RESOURCES } from "@/components/Factory/data/resources";
import type { ProductionMethod } from "@/components/Factory/types/production";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface ProductionInputsProps {
  productionMethod: ProductionMethod;
}

export const ProductionInputs = ({
  productionMethod,
}: ProductionInputsProps) => {
  if (productionMethod.inputs.length === 0) return null;

  return (
    <BlockStack gap="1">
      <Text size="xs" tone="subdued">
        Inputs:
      </Text>
      {productionMethod.inputs.map((input, idx) => (
        <InlineStack key={idx} gap="2">
          {input.resource === "any" ? (
            <Text size="sm">• any</Text>
          ) : (
            <>
              <Text size="sm">
                • {input.amount}x {input.resource}
              </Text>
              <Text size="xs" tone="subdued">
                ({RESOURCES.money.icon}{" "}
                {input.amount * RESOURCES[input.resource].value})
              </Text>
            </>
          )}
        </InlineStack>
      ))}
    </BlockStack>
  );
};
