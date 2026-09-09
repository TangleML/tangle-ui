import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph, Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

import type { HostMigration } from "./useHostMigration";

export function HostMigrationNotice({
  migration,
  storageLabel,
}: {
  migration: HostMigration;
  storageLabel: string;
}) {
  const { phase, progress, failed, error, retry, skip } = migration;

  if (phase === "copying") {
    return (
      <BlockStack gap="2" align="center">
        <InlineStack gap="2" blockAlign="center">
          <Spinner size={16} />
          <Text>Moving your pipelines to {storageLabel}</Text>
        </InlineStack>
        <Text size="sm" tone="subdued">
          {progress.total > 0
            ? `${progress.copied} of ${progress.total} copied`
            : "Starting…"}
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="3" align="center">
      <InlineStack gap="2" blockAlign="center">
        <Icon name="CircleAlert" className="text-destructive" />
        <Text>
          {error
            ? `Your pipelines could not be moved to ${storageLabel}`
            : `${failed.length} ${pluralize(failed.length, "pipeline")} could not be copied to ${storageLabel}`}
        </Text>
      </InlineStack>
      <Paragraph size="sm" tone="subdued">
        {error ?? (
          <>
            {failed.slice(0, 5).join(", ")}
            {failed.length > 5 && ` and ${failed.length - 5} more`}.
          </>
        )}{" "}
        They are still in this browser and nothing has been deleted.
      </Paragraph>
      <InlineStack gap="2">
        <Button onClick={retry}>Retry</Button>
        <Button variant="secondary" onClick={skip}>
          Continue without them
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
