import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

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
  } = building;

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
                    <Text size="sm">
                      • {input.amount}x {input.resource}
                    </Text>
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
                  </InlineStack>
                ))}
              </BlockStack>
            )}

            <InlineStack gap="2">
              <Icon name="Clock" size="sm" />
              <Text size="sm">{`${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}</Text>
            </InlineStack>
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
            {stockpile.map((stock, idx) => (
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
            ))}
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
