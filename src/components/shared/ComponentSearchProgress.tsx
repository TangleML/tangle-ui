import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import type { RerankProgress } from "@/services/naturalLanguageComponentSearchService";

export function ComponentSearchProgress({
  progress,
  modelLabel = "AI",
  onCancel,
}: {
  progress?: RerankProgress;
  modelLabel?: string;
  onCancel: () => void;
}) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className="rounded-md bg-muted/50 px-3 py-2"
    >
      <Spinner size={14} />
      <Text
        size="xs"
        tone="subdued"
        role="status"
        aria-live="polite"
        className="flex-1"
      >
        {progress
          ? `Scored ${progress.completed} of ${progress.total} components with ${modelLabel}…`
          : `Searching components with ${modelLabel}…`}
      </Text>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Cancel AI search"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </InlineStack>
  );
}
