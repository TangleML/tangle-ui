import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

import { RESOURCES } from "../data/resources";
import type { Building } from "../types/buildings";

interface BuildingContextProps {
  building: Building;
}

const BuildingContext = ({ building }: BuildingContextProps) => {
  const {
    icon,
    name,
    description,
    cost,
    productionMethod,
    inputs = [],
    outputs = [],
    stockpile = [],
    productionState,
  } = building;

  const progressPercentage =
    productionMethod && productionState
      ? (productionState.progress / productionMethod.days) * 100
      : 0;

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="building-overview"
    >
      <InlineStack gap="2">
        <Text size="lg" weight="semibold" className="wrap-anywhere">
          {icon} {name}
        </Text>
      </InlineStack>

      <Text size="sm" tone="subdued">
        {description}
      </Text>

      {cost !== undefined && (
        <InlineStack gap="2" align="center">
          <Icon name="Coins" size="sm" />
          <Text size="sm">Cost: {cost}</Text>
        </InlineStack>
      )}

      <Separator />

      <BlockStack gap="3">
        <Text size="sm" weight="semibold">
          Production Method
        </Text>

        {!!productionMethod?.name && (
          <InlineStack gap="2">
            <Icon name="Bookmark" size="sm" />
            <Text size="sm">{productionMethod.name}</Text>
          </InlineStack>
        )}

        {productionMethod && (
          <BlockStack gap="2">
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
                          ({RESOURCES.coins.icon}{" "}
                          {input.amount * RESOURCES[input.resource].value})
                        </Text>
                      </>
                    )}
                  </InlineStack>
                ))}
              </BlockStack>
            )}

            {productionMethod.outputs.length > 0 && (
              <BlockStack gap="1">
                <Text size="xs" tone="subdued">
                  Outputs:
                </Text>
                {productionMethod.outputs.map((output, idx) => (
                  <InlineStack key={idx} gap="2">
                    <Text size="sm">
                      • {output.amount}x {output.resource}
                    </Text>
                    <Text size="xs" tone="subdued">
                      ({RESOURCES.coins.icon}{" "}
                      {output.amount * RESOURCES[output.resource].value})
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            )}

            {productionMethod.globalOutputs &&
              productionMethod.globalOutputs.length > 0 && (
                <BlockStack gap="1">
                  <Text size="xs" tone="subdued">
                    Global Outputs:
                  </Text>
                  {productionMethod.globalOutputs.map((output, idx) => (
                    <InlineStack key={idx} gap="2">
                      <Icon name="Globe" size="sm" />
                      <Text size="sm">
                        {RESOURCES[output.resource].icon} {output.resource}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              )}

            <InlineStack gap="2">
              <Icon name="Clock" size="sm" />
              <Text size="sm">{`${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}</Text>
            </InlineStack>

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
        )}

        {!productionMethod && (
          <Text size="sm" tone="subdued">
            No production method defined
          </Text>
        )}
      </BlockStack>

      <Separator />

      <BlockStack gap="2">
        <Text size="sm" weight="semibold">
          Stockpile
        </Text>
        {stockpile.length > 0 ? (
          <BlockStack gap="1">
            {stockpile.map((stock, idx) => {
              if (
                stock.resource === "any" &&
                stock.breakdown &&
                stock.breakdown.size > 0
              ) {
                // Calculate total value of all resources in "any" stockpile
                let totalValue = 0;
                stock.breakdown.forEach((amount, resourceType) => {
                  const resourceValue = RESOURCES[resourceType]?.value || 1;
                  totalValue += amount * resourceValue;
                });

                return (
                  <BlockStack key={idx} gap="1">
                    {Array.from(stock.breakdown.entries()).map(
                      ([resource, amount]) => (
                        <InlineStack key={resource} gap="2" align="center">
                          <Text size="sm" className="min-w-20">
                            {resource}: {amount}
                          </Text>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{
                                width: `${(stock.amount / stock.maxAmount) * 100}%`,
                              }}
                            />
                          </div>
                        </InlineStack>
                      ),
                    )}
                    <InlineStack gap="2" align="center">
                      <Text size="xs" tone="subdued">
                        Total: {stock.amount} / {stock.maxAmount}
                      </Text>
                      <Text size="xs" tone="subdued">
                        • Expected Value: {RESOURCES.coins.icon} {totalValue}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                );
              }

              return (
                <InlineStack key={idx} gap="2" align="center">
                  <Text size="sm">
                    {stock.resource}: {stock.amount} / {stock.maxAmount}
                  </Text>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${(stock.amount / stock.maxAmount) * 100}%`,
                      }}
                    />
                  </div>
                </InlineStack>
              );
            })}
          </BlockStack>
        ) : (
          <Text size="sm" tone="subdued">
            No stockpile
          </Text>
        )}
      </BlockStack>

      <Separator />

      <BlockStack gap="2">
        <Text size="sm" weight="semibold">
          Connections
        </Text>
        <BlockStack gap="1">
          <Text size="xs" tone="subdued">
            Inputs: {inputs.length}
          </Text>
          <Text size="xs" tone="subdued">
            Outputs: {outputs.length}
          </Text>
        </BlockStack>
      </BlockStack>
    </BlockStack>
  );
};

export default BuildingContext;
