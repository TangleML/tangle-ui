import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";

import type { Resource } from "../types/resources";

interface ResourceContextProps {
  resource: Resource;
  sourceNodeId?: string;
  targetNodeId?: string;
}

const ResourceContext = ({
  resource,
  sourceNodeId,
  targetNodeId,
}: ResourceContextProps) => {
  const { name, description, color, icon } = resource;

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
      </BlockStack>
    </BlockStack>
  );
};

export default ResourceContext;
