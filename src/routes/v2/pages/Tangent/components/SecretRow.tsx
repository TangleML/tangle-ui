import { RemoveSecretButton } from "@/components/shared/SecretsManagement/components/RemoveSecretButton";
import type { Secret } from "@/components/shared/SecretsManagement/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { ListRowIcon } from "./ListRowIcon";

interface SecretRowProps {
  secret: Secret;
  teamId: string;
  canWrite: boolean;
  onReplace: (secret: Secret) => void;
  onRemoved: () => void;
}

function secretDetail(secret: Secret): string {
  return (
    secret.description || `Updated ${formatRelativeTime(secret.updatedAt)}`
  );
}

export function SecretRow({
  secret,
  teamId,
  canWrite,
  onReplace,
  onRemoved,
}: SecretRowProps) {
  const detail = secretDetail(secret);

  return (
    <InlineStack
      gap="3"
      blockAlign="start"
      wrap="nowrap"
      className="w-full px-2 py-2"
      data-testid="secret-item"
      data-secret-name={secret.name}
    >
      <ListRowIcon icon="KeyRound" />
      <BlockStack align="start" className="min-w-0 flex-1">
        <Text
          size="sm"
          weight="medium"
          font="mono"
          className="max-w-full truncate"
          title={secret.name}
        >
          {secret.name}
        </Text>
        <Text
          size="xs"
          tone="subdued"
          className="max-w-full truncate"
          title={detail}
        >
          {detail}
        </Text>
      </BlockStack>
      {canWrite && (
        <InlineStack gap="1" wrap="nowrap" className="shrink-0">
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Replace ${secret.name}`}
            onClick={() => onReplace(secret)}
            {...tracking("projects.secrets.replace_open")}
          >
            <Icon name="Pencil" size="sm" />
          </Button>
          <RemoveSecretButton
            secret={secret}
            teamId={teamId}
            onSuccess={onRemoved}
          />
        </InlineStack>
      )}
    </InlineStack>
  );
}
