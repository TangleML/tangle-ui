import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { RunDiffResult } from "@/utils/diff/types";
import { pluralize } from "@/utils/string";

interface DiffSummaryProps {
  diff: RunDiffResult;
}

interface SummaryCardProps {
  title: string;
  count: number;
  icon: string;
  variant: "default" | "success" | "warning" | "error";
}

const SummaryCard = ({ title, count, icon, variant }: SummaryCardProps) => {
  const variantStyles = {
    default: "border-border bg-card",
    success: "border-green-500 bg-green-50 dark:bg-green-900/10",
    warning: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10",
    error: "border-red-500 bg-red-50 dark:bg-red-900/10",
  };

  return (
    <div
      className={cn(
        "border rounded-lg p-4 h-full",
        variantStyles[variant],
      )}
    >
      <BlockStack gap="2" className="h-full">
        <InlineStack gap="2" blockAlign="center">
          <Icon name={icon as any} className="w-4 h-4 shrink-0" />
          <Text size="sm" tone="subdued" className="truncate">
            {title}
          </Text>
        </InlineStack>
        <Text size="2xl" weight="bold">
          {count}
        </Text>
      </BlockStack>
    </div>
  );
};

export const DiffSummary = ({ diff }: DiffSummaryProps) => {
  const { tasks, summary } = diff;

  const taskChanges = tasks.added.length + tasks.removed.length + tasks.modified.length;

  if (!summary.hasChanges) {
    return (
      <div className="border border-green-500 bg-green-50 dark:bg-green-900/10 rounded-lg p-4">
        <InlineStack gap="2" blockAlign="center">
          <Icon name="Check" className="w-5 h-5 text-green-600" />
          <Text weight="semibold">No differences found between runs</Text>
        </InlineStack>
      </div>
    );
  }

  return (
    <BlockStack gap="4">
      <Text as="h3" size="lg" weight="semibold">
        Summary
      </Text>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Argument Changes"
          count={summary.totalArgumentChanges}
          icon="Settings"
          variant={summary.totalArgumentChanges > 0 ? "warning" : "default"}
        />

        <SummaryCard
          title="Task Changes"
          count={taskChanges}
          icon="Workflow"
          variant={taskChanges > 0 ? "warning" : "default"}
        />

        <SummaryCard
          title="Tasks Added"
          count={tasks.added.length}
          icon="Plus"
          variant={tasks.added.length > 0 ? "success" : "default"}
        />

        <SummaryCard
          title="Tasks Removed"
          count={tasks.removed.length}
          icon="Minus"
          variant={tasks.removed.length > 0 ? "error" : "default"}
        />
      </div>

      {summary.hasChanges && (
        <Text size="sm" tone="subdued">
          Found {summary.totalArgumentChanges}{" "}
          {pluralize(summary.totalArgumentChanges, "argument change")} and{" "}
          {taskChanges} {pluralize(taskChanges, "task change")} across{" "}
          {diff.runIds.length} runs.
        </Text>
      )}
    </BlockStack>
  );
};

