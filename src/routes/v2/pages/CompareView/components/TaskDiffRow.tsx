import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { TaskDiff } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import {
  EXECUTION_STATUS_BG_COLORS,
  getExecutionStatusLabel,
} from "@/utils/executionStatus";

import { DiffStatusBadge } from "./DiffStatusBadge";
import { FieldDiffRow } from "./FieldDiffRow";

interface ExecutionStatusPillProps {
  label: string;
  status: string | undefined;
}

function ExecutionStatusPill({ label, status }: ExecutionStatusPillProps) {
  if (!status) return null;

  return (
    <InlineStack gap="1" blockAlign="center" wrap="nowrap">
      <Text as="span" size="xs" tone="subdued">
        {label}
      </Text>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          EXECUTION_STATUS_BG_COLORS[status] ?? "bg-gray-400",
        )}
      />
      <Text as="span" size="xs">
        {getExecutionStatusLabel(status)}
      </Text>
    </InlineStack>
  );
}

interface TaskDiffRowProps {
  diff: TaskDiff;
  labelA: string;
  labelB: string;
}

export function TaskDiffRow({ diff, labelA, labelB }: TaskDiffRowProps) {
  const changedArguments = diff.argumentDiffs.filter(
    (entry) => entry.status !== "unchanged",
  );
  const changedAnnotations = diff.annotationDiffs.filter(
    (entry) => entry.status !== "unchanged",
  );

  const componentChanged =
    diff.status === "changed" && !diff.sameComponentVersion;
  const hasFieldChanges =
    componentChanged ||
    changedArguments.length > 0 ||
    changedAnnotations.length > 0;

  return (
    <BlockStack
      gap="4"
      className={cn(
        "rounded-lg border p-4",
        diff.outcomeChanged ? "border-amber-300" : "border-border",
      )}
    >
      <BlockStack gap="2">
        <InlineStack gap="2" blockAlign="center" wrap="wrap">
          <Text as="span" size="sm" weight="semibold" className="font-mono">
            {diff.taskId}
          </Text>
          <DiffStatusBadge status={diff.status} />
        </InlineStack>
        <InlineStack gap="2" blockAlign="center" wrap="wrap">
          <ExecutionStatusPill label={labelA} status={diff.statusA} />
          {diff.outcomeChanged && diff.statusA && diff.statusB && (
            <Icon
              name="ArrowRight"
              size="xs"
              className="text-muted-foreground"
            />
          )}
          <ExecutionStatusPill label={labelB} status={diff.statusB} />
        </InlineStack>
      </BlockStack>

      {componentChanged && (
        <BlockStack gap="1">
          <Text as="span" size="xs" weight="semibold" tone="subdued">
            Component
          </Text>
          <Text as="span" size="xs" className="font-mono">
            {diff.digestA?.slice(0, 8) ?? "—"} →{" "}
            {diff.digestB?.slice(0, 8) ?? "—"}
          </Text>
        </BlockStack>
      )}

      {changedArguments.length > 0 && (
        <BlockStack gap="1">
          <Text as="span" size="xs" weight="semibold" tone="subdued">
            Arguments
          </Text>
          {changedArguments.map((entry) => (
            <FieldDiffRow
              key={entry.key}
              entry={entry}
              labelA={labelA}
              labelB={labelB}
            />
          ))}
        </BlockStack>
      )}

      {changedAnnotations.length > 0 && (
        <BlockStack gap="1">
          <Text as="span" size="xs" weight="semibold" tone="subdued">
            Annotations
          </Text>
          {changedAnnotations.map((entry) => (
            <FieldDiffRow
              key={entry.key}
              entry={entry}
              labelA={labelA}
              labelB={labelB}
            />
          ))}
        </BlockStack>
      )}

      {!hasFieldChanges && (
        <Text as="span" size="sm" tone="subdued">
          {diff.outcomeChanged
            ? "No configuration changes — the execution outcome differs between runs."
            : "No differences in this task."}
        </Text>
      )}
    </BlockStack>
  );
}
