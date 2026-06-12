import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function SecretsBackendUnavailable() {
  return (
    <BlockStack
      align="center"
      className="py-8"
      data-testid="secrets-backend-unavailable"
    >
      <Icon name="DatabaseZap" size="lg" className="text-subdued" />
      <Text tone="subdued">Backend not connected</Text>
      <Text size="xs" tone="subdued">
        Secrets are stored on your Tangle backend. Connect one in Settings to
        manage secrets.
      </Text>
    </BlockStack>
  );
}
