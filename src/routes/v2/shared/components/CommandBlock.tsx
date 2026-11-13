import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { CopyValueButton } from "@/routes/v2/shared/components/CopyValueButton";

export function CommandBlock({
  command,
  wrap = false,
  trackingId,
  trackingMetadata,
}: {
  command: string;
  wrap?: boolean;
  trackingId?: string;
  trackingMetadata?: Record<string, unknown>;
}) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      wrap="nowrap"
      className="w-full min-w-0 rounded-md border border-border bg-muted px-3 py-2"
    >
      <Text
        size="sm"
        font="mono"
        className={cn(
          "min-w-0 flex-1",
          wrap
            ? "whitespace-pre-wrap wrap-anywhere"
            : "overflow-x-auto whitespace-pre",
        )}
      >
        {command}
      </Text>
      <CopyValueButton
        valueFn={() => command}
        trackingId={trackingId}
        trackingMetadata={trackingMetadata}
      />
    </InlineStack>
  );
}
