import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { CopyValueButton } from "@/routes/v2/shared/components/CopyValueButton";

export function CommandBlock({
  command,
  contained = false,
  trackingId,
  trackingMetadata,
}: {
  command: string;
  contained?: boolean;
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
      {contained ? (
        // Absolutely positioned so the long command never contributes to the
        // intrinsic width of the dialog's nested grids, which would otherwise
        // stretch the whole dialog wider than its box. The command then scrolls
        // horizontally within the fixed-width container instead.
        <div className="relative h-5 min-w-0 flex-1">
          <Text
            size="sm"
            font="mono"
            className="absolute inset-0 overflow-x-auto whitespace-pre leading-5"
          >
            {command}
          </Text>
        </div>
      ) : (
        <Text
          size="sm"
          font="mono"
          className="min-w-0 flex-1 overflow-x-auto whitespace-pre"
        >
          {command}
        </Text>
      )}
      <CopyValueButton
        valueFn={() => command}
        trackingId={trackingId}
        trackingMetadata={trackingMetadata}
      />
    </InlineStack>
  );
}
