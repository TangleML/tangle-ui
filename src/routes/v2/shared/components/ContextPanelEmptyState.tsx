import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function ContextPanelEmptyState() {
  return (
    <Box padding="lg" blockSize="full" inlineSize="full">
      <BlockStack fill gap="2">
        <Icon name="MousePointerClick" size="lg" tone="weak" />
        <Text size="sm" tone="subdued" align="center">
          Select a node to view details
        </Text>
      </BlockStack>
    </Box>
  );
}
