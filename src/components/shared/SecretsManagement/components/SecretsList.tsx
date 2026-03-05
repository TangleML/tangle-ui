import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { formatRelativeTime } from "@/utils/date";

import { withSuspenseWrapper } from "../../SuspenseWrapper";
import { fetchSecretsList } from "../secretsStorage";
import { SecretsQueryKeys } from "../types";
import { RemoveSecretButton } from "./RemoveSecretButton";

interface SecretsListProps {
  onRemoveSuccess?: () => void;
}

function SecretsListInternal({ onRemoveSuccess }: SecretsListProps) {
  const { data: secrets } = useSuspenseQuery({
    queryKey: SecretsQueryKeys.All(),
    queryFn: fetchSecretsList,
  });

  if (secrets.length === 0) {
    return (
      <BlockStack
        align="center"
        className="py-8"
        data-testid="secrets-empty-state"
      >
        <Icon name="Lock" size="lg" className="text-subdued" />
        <Text tone="subdued">No secrets configured</Text>
        <Text size="xs" tone="subdued">
          Add a secret to get started
        </Text>
      </BlockStack>
    );
  }

  return (
    <div
      className="w-full min-h-[100px] max-h-[80vh] overflow-y-auto"
      data-testid="secrets-list"
    >
      <BlockStack gap="2">
        {secrets.map((secret) => (
          <InlineStack
            key={secret.id}
            align="space-between"
            gap="2"
            className="w-full pr-3 py-1.5 hover:bg-gray-50 rounded-md pl-1"
            data-testid="secret-item"
            data-secret-name={secret.name}
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
              <Link
                to="/settings/secrets/$secretId/replace"
                params={{ secretId: secret.id }}
                replace
                data-testid="secret-edit-button"
              >
                <Button variant="ghost" size="xs">
                  <Icon name="Pencil" size="sm" />
                </Button>
              </Link>
              <RemoveSecretButton secret={secret} onSuccess={onRemoveSuccess} />
            </InlineStack>
          </InlineStack>
        ))}
      </BlockStack>
    </div>
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
