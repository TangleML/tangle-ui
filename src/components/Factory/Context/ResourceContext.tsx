import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";

import { RESOURCES } from "../data/resources";
import { useStatistics } from "../providers/StatisticsProvider";
import type { Resource } from "../types/resources";

interface ResourceContextProps {
  resource: Resource;
  sourceNodeId?: string;
  targetNodeId?: string;
  edgeId?: string;
}

const ResourceContext = ({
  resource,
  sourceNodeId,
  targetNodeId,
  edgeId,
}: ResourceContextProps) => {
  const { name, description, color, icon, value, foodValue } = resource;

  const { getLatestEdgeStats } = useStatistics();

  const edgeTransfers = edgeId
    ? getLatestEdgeStats(edgeId, resource.type === "any")
    : [];

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="resource-overview"
    >
      <InlineStack gap="2">
        <Text size="lg" weight="semibold" className="wrap-anywhere">
          {icon} {name}
        </Text>
      </InlineStack>

      <div
        className="w-full h-3 rounded-full"
        style={{ backgroundColor: color }}
      />

      <Text size="sm" tone="subdued">
        {description}
      </Text>

      <InlineStack gap="2" blockAlign="center">
        <Text size="sm" weight="semibold">
          Value:
        </Text>
        <Text size="sm">💰 {value}</Text>
        {foodValue && <Text size="sm">/ 🍎 {foodValue}</Text>}
      </InlineStack>

      <Separator />

      <BlockStack gap="2">
        <Text size="sm" weight="semibold">
          Connection
        </Text>
        <BlockStack gap="1">
          {sourceNodeId && (
            <Text size="xs" tone="subdued">
              From: {sourceNodeId}
            </Text>
          )}
          {targetNodeId && (
            <Text size="xs" tone="subdued">
              To: {targetNodeId}
            </Text>
          )}
        </BlockStack>
        <Text size="xs" weight="light">
          Transported Yesterday:
        </Text>
        {edgeTransfers.length > 0 ? (
          edgeTransfers.map((transfer, index) => (
            <Text key={index} size="xs" tone="subdued">
              {RESOURCES[transfer.resource].icon} {transfer.transferred}{" "}
              {RESOURCES[transfer.resource].name}
            </Text>
          ))
        ) : (
          <Text size="xs" tone="subdued">
            No recent transfers
          </Text>
        )}
      </BlockStack>
    </BlockStack>
  );
};

export default ResourceContext;
