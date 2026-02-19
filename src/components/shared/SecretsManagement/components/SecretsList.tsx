import { useSuspenseQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { formatRelativeTime } from "@/utils/date";

import { withSuspenseWrapper } from "../../SuspenseWrapper";
import { fetchSecretsList } from "../secretsStorage";
import { type Secret, SecretsQueryKeys } from "../types";
import { RemoveSecretButton } from "./RemoveSecretButton";

interface SecretsListProps {
  onReplace: (secret: Secret) => void;
  onRemoveSuccess?: () => void;
}

function SecretsListInternal({ onReplace, onRemoveSuccess }: SecretsListProps) {
  const { data: secrets } = useSuspenseQuery({
    queryKey: SecretsQueryKeys.All(),
    queryFn: fetchSecretsList,
  });

  if (secrets.length === 0) {
    return (
      <BlockStack align="center" className="py-8">
        <Icon name="Lock" size="lg" className="text-subdued" />
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
            className="w-full pr-3 py-1.5 hover:bg-gray-50 rounded-md pl-1"
          >
            <InlineStack gap="2" blockAlign="center" wrap="nowrap">
              <Icon name="Lock" size="lg" className="shrink-0" />
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
                <Icon name="Pencil" size="sm" />
              </Button>
              <RemoveSecretButton secret={secret} onSuccess={onRemoveSuccess} />
            </InlineStack>
          </InlineStack>
        ))}
      </BlockStack>
    </ScrollArea>
  );
}

function SecretsListSkeleton() {
  return (
    <BlockStack align="start" gap="3" fill>
      <Skeleton size="full" />
      <Skeleton size="full" />
      <Skeleton size="full" />
    </BlockStack>
  );
}

export const SecretsList = withSuspenseWrapper(
  SecretsListInternal,
  SecretsListSkeleton,
);
