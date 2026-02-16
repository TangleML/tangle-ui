import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { isGlobalResource, RESOURCES } from "../../data/resources";
import { useStatistics } from "../../providers/StatisticsProvider";
import type { BuildingInstance, Stockpile } from "../../types/buildings";
import type { ResourceType } from "../../types/resources";
import type { StockpileChange } from "../../types/statistics";

interface StockpileSectionProps {
  nodeId: string;
  stockpile: Stockpile[];
  building: BuildingInstance;
}

export const StockpileSection = ({
  nodeId,
  stockpile,
  building,
}: StockpileSectionProps) => {
  const { getLatestBuildingStats } = useStatistics();
  const statistics = getLatestBuildingStats(nodeId);

  const hasGlobalOutputs = building.productionMethod?.outputs.some((output) =>
    isGlobalResource(output.resource),
  );

  if (stockpile.length === 0) {
    return (
      <BlockStack gap="2">
        <Text size="sm" weight="semibold">
          Stockpile
        </Text>
        <Text size="sm" tone="subdued">
          No stockpile
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="2">
      <Text size="sm" weight="semibold">
        Stockpile
      </Text>
      <BlockStack gap="1">
        {stockpile.map((stock, idx) => {
          // Handle "any" resource with breakdown
          if (
            stock.resource === "any" &&
            stock.breakdown &&
            stock.breakdown.size > 0
          ) {
            let totalValue = 0;
            stock.breakdown.forEach((amount, resourceType) => {
              const resourceValue = RESOURCES[resourceType]?.value || 1;
              totalValue += amount * resourceValue;
            });

            return (
              <BlockStack key={idx} gap="1">
                {Array.from(stock.breakdown.entries()).map(
                  ([resource, amount]) => {
                    const change = statistics?.stockpileChanges.find(
                      (c) => c.resource === resource,
                    );

                    return (
                      <InlineStack key={resource} gap="2" align="center">
                        <Text size="sm" className="min-w-20">
                          {resource}: {amount}
                        </Text>
                        <StockpileChangeIndicator change={change} />
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
                  },
                )}
                <InlineStack gap="2" align="center">
                  <Text size="xs" tone="subdued">
                    Total: {stock.amount} / {stock.maxAmount}
                  </Text>
                  <Text size="xs" tone="subdued">
                    •
                  </Text>
                  <Text size="xs" tone="subdued">
                    Expected Value: {RESOURCES.money.icon} {totalValue}
                  </Text>
                </InlineStack>
              </BlockStack>
            );
          }

          // Regular stockpile
          const change = statistics?.stockpileChanges.find(
            (c) => c.resource === stock.resource,
          );

          return (
            <InlineStack key={idx} gap="2" align="center">
              <Text size="sm">
                {stock.resource}: {stock.amount} / {stock.maxAmount}
              </Text>
              <StockpileChangeIndicator change={change} />
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

      {/* Show global output production stats */}
      {hasGlobalOutputs && statistics?.produced && (
        <BlockStack gap="1">
          {Object.entries(statistics.produced).map(([resource, amount]) => (
            <Text key={resource} size="xs" className="text-green-600">
              Previous Day: +{amount}{" "}
              {RESOURCES[resource as ResourceType]?.icon}
            </Text>
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
};

interface StockpileChangeIndicatorProps {
  change?: StockpileChange;
}

const StockpileChangeIndicator = ({
  change,
}: StockpileChangeIndicatorProps) => {
  const { added, removed } = change || { added: 0, removed: 0 };

  if (added === 0 && removed === 0) {
    return (
      <Text size="xs" tone="subdued" className="ml-1">
        (-)
      </Text>
    );
  }

  return (
    <InlineStack gap="1" className="ml-1">
      <Text size="xs" tone="subdued">
        (
      </Text>
      {added > 0 && (
        <Text size="xs" className="text-green-600">
          +{added}
        </Text>
      )}
      {removed > 0 && (
        <Text size="xs" className="text-red-600">
          -{removed}
        </Text>
      )}
      <Text size="xs" tone="subdued">
        )
      </Text>
    </InlineStack>
  );
};
