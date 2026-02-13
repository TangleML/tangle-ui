import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

import { RESOURCES } from "../../data/resources";
import type { ProductionMethod, ProductionState } from "../../types/buildings";

interface ProductionMethodSectionProps {
  productionMethod?: ProductionMethod;
  productionState?: ProductionState;
}

export const ProductionMethodSection = ({
  productionMethod,
  productionState,
}: ProductionMethodSectionProps) => {
  if (!productionMethod) {
    return (
      <BlockStack gap="2">
        <Text size="sm" weight="semibold">
          Production Method
        </Text>
        <Text size="sm" tone="subdued">
          No production method defined
        </Text>
      </BlockStack>
    );
  }

  const progressPercentage = productionState
    ? (productionState.progress / productionMethod.days) * 100
    : 0;

  return (
    <BlockStack gap="3">
      <Text size="sm" weight="semibold">
        Production Method
      </Text>

      {productionMethod.name && (
        <InlineStack gap="2">
          <Icon name="Bookmark" size="sm" />
          <Text size="sm">{productionMethod.name}</Text>
        </InlineStack>
      )}

      <BlockStack gap="2">
        {/* Inputs */}
        {productionMethod.inputs.length > 0 && (
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
        )}

        {/* Outputs */}
        {productionMethod.outputs.length > 0 && (
          <BlockStack gap="1">
            <Text size="xs" tone="subdued">
              Outputs:
            </Text>
            {productionMethod.outputs.map((output, idx) => {
              if (RESOURCES[output.resource].global) {
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
        )}

        {/* Duration */}
        <InlineStack gap="2">
          <Icon name="Clock" size="sm" />
          <Text size="sm">{`${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}</Text>
        </InlineStack>

        {/* Progress */}
        {productionState && (
          <BlockStack gap="1">
            <Text size="xs" tone="subdued">
              {productionState.status === "idle" && "Idle"}
              {productionState.status === "active" &&
                `Progress: ${productionState.progress} / ${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}
              {productionState.status === "paused" &&
                `Paused: ${productionState.progress} / ${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}
              {productionState.status === "complete" &&
                `Complete: ${productionState.progress} / ${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}
            </Text>
            <Progress value={progressPercentage} className="h-2" />
          </BlockStack>
        )}
      </BlockStack>
    </BlockStack>
  );
};
