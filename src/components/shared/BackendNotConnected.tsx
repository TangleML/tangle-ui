import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface BackendNotConnectedProps {
  description: string;
  "data-testid"?: string;
}

export function BackendNotConnected({
  description,
  "data-testid": testId,
}: BackendNotConnectedProps) {
  return (
    <BlockStack align="center" className="py-8" data-testid={testId}>
      <Icon name="DatabaseZap" size="lg" className="text-subdued" />
      <Text tone="subdued">Backend not connected</Text>
      <Text size="xs" tone="subdued">
        {description}
      </Text>
    </BlockStack>
  );
}
