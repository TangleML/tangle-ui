import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { RUN_STATUS_LABELS } from "@/routes/tangent/labels";
import type { RunStatus } from "@/routes/tangent/types";

interface RunStatusIndicatorProps {
  status: RunStatus;
}

const DOT_CLASS: Record<RunStatus, string> = {
  succeeded: "bg-emerald-500",
  failed: "bg-destructive",
  running: "bg-amber-500 animate-pulse",
};

export function RunStatusIndicator({ status }: RunStatusIndicatorProps) {
  return (
    <InlineStack gap="2" blockAlign="center" wrap="nowrap">
      <span
        className={cn("inline-block size-2 rounded-full", DOT_CLASS[status])}
        aria-hidden
      />
      <Text size="sm">{RUN_STATUS_LABELS[status]}</Text>
    </InlineStack>
  );
}
