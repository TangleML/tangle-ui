import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Text } from "@/components/ui/typography";
import { formatRelativeTime } from "@/utils/date";

import type { Secret } from "../types";
import { RemoveSecretButton } from "./RemoveSecretButton";

interface SecretsListProps {
  secrets: Secret[];
  onReplace: (secret: Secret) => void;
  onRemoveSuccess?: () => void;
}

export function SecretsList({
  secrets,
  onReplace,
  onRemoveSuccess,
}: SecretsListProps) {
  if (secrets.length === 0) {
    return (
      <BlockStack align="center" className="py-8">
        <Icon name="Lock" size="lg" className="text-gray-300" />
        <Text tone="subdued">No secrets configured</Text>
        <Text size="xs" tone="subdued">
          Add a secret to get started
        </Text>
      </BlockStack>
    );
  }

  return (
    <ScrollArea className="w-full min-h-[100px] max-h-[300px]" type="always">
      <BlockStack gap="2">
        {secrets.map((secret) => (
          <InlineStack
            key={secret.id}
            align="space-between"
            gap="2"
            className="w-full pr-3 py-1.5 hover:bg-gray-50 rounded-md"
          >
            <InlineStack gap="2" blockAlign="center" wrap="nowrap">
              <Icon name="Lock" size="lg" />
              <BlockStack gap="0">
                <Text size="sm" weight="semibold">
                  {secret.name}
                </Text>
                <Text size="xs" tone="subdued">
                  Added {formatRelativeTime(secret.createdAt)}
                </Text>
              </BlockStack>
            </InlineStack>

            <InlineStack gap="1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onReplace(secret)}
              >
                <Icon name="RefreshCw" size="sm" />
              </Button>
              <RemoveSecretButton secret={secret} onSuccess={onRemoveSuccess} />
            </InlineStack>
          </InlineStack>
        ))}
      </BlockStack>
    </ScrollArea>
  );
}
