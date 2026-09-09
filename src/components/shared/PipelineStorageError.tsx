import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import {
  AmbiguousPipelineNameError,
  getPipelineStorageService,
  PipelineNotFoundError,
} from "@/services/pipelineStorage/PipelineStorageService";
import { getErrorMessage } from "@/utils/string";

/**
 * Shown in place of whatever could not be read. A store that answers nothing
 * must not look like a store holding nothing: "you have no pipelines yet" in
 * front of a library that is merely unreachable invites someone to build the
 * same pipeline a second time.
 */
export function PipelineStorageError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { mode } = getPipelineStorageService();
  const storageLabel =
    mode.kind === "backend" ? mode.label : "Pipeline storage";

  const headline =
    error instanceof PipelineNotFoundError ||
    error instanceof AmbiguousPipelineNameError
      ? "This pipeline could not be opened"
      : `${storageLabel} could not be read`;

  return (
    <BlockStack
      align="center"
      gap="2"
      className="py-8"
      data-testid="pipeline-storage-error"
    >
      <Icon name="DatabaseZap" size="lg" className="text-subdued" />
      <Text tone="subdued">{headline}</Text>
      <Text size="xs" tone="subdued">
        {getErrorMessage(error)}
      </Text>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </BlockStack>
  );
}
