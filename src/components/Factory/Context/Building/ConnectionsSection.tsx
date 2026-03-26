import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface ConnectionsSectionProps {
  inputCount: number;
  outputCount: number;
}

export const ConnectionsSection = ({
  inputCount,
  outputCount,
}: ConnectionsSectionProps) => {
  return (
    <BlockStack gap="2">
      <Text size="sm" weight="semibold">
        Connections
      </Text>
      <BlockStack gap="1">
        <Text size="xs" tone="subdued">
          Inputs: {inputCount}
        </Text>
        <Text size="xs" tone="subdued">
          Outputs: {outputCount}
        </Text>
      </BlockStack>
    </BlockStack>
  );
};
