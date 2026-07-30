import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { MergedIoNodeData } from "@/routes/v2/pages/CompareView/utils/buildMergedGraph";
import type {
  DiffStatus,
  KeyedDiffEntry,
} from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import { summarizeIoChange } from "@/routes/v2/pages/CompareView/utils/summarizeChange";

import { DiffStatusBadge } from "./DiffStatusBadge";
import { SideValues } from "./SideValues";

const MEMBERSHIP_BORDER: Record<DiffStatus, string> = {
  unchanged: "border-gray-300",
  lost: "border-red-400",
  new: "border-green-500",
  changed: "border-amber-400",
};

/**
 * Slight background tint hinting at the node's kind, echoing the blue inputs /
 * violet outputs of the editor and run views so they read at a glance.
 */
const KIND_TINT: Record<"input" | "output", string> = {
  input: "bg-blue-50 dark:bg-blue-950/40",
  output: "bg-violet-50 dark:bg-violet-950/40",
};

const MAX_IO_FIELDS = 2;
const LONG_IO_VALUE = 22;

function formatIoValue(value: unknown): string {
  if (value === undefined) return "(unset)";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function ioFieldLabel(key: string): string {
  return key === "default" || key === "value" ? "value" : key;
}

/**
 * Compact rendering of what changed on an input/output between the two runs.
 * Short scalar changes are shown as a `before → after` transition (before
 * struck through); anything too long collapses to a "<field> changed" label.
 */
function IoFieldChanges({ fields }: { fields: KeyedDiffEntry<unknown>[] }) {
  const shown = fields.slice(0, MAX_IO_FIELDS);
  const remaining = fields.length - shown.length;

  return (
    <BlockStack gap="0" className="w-full">
      {shown.map((entry) => {
        const before = formatIoValue(entry.a);
        const after = formatIoValue(entry.b);
        const label = ioFieldLabel(entry.key);
        const fits = before.length + after.length <= LONG_IO_VALUE;
        return (
          <Text
            key={entry.key}
            as="span"
            size="xs"
            tone="subdued"
            className={cn("w-full truncate", fits && "font-mono")}
            title={`${label}: ${before} → ${after}`}
          >
            {fits ? (
              <>
                <span className="line-through opacity-70">{before}</span> →{" "}
                {after}
              </>
            ) : (
              `${label} changed`
            )}
          </Text>
        );
      })}
      {remaining > 0 && (
        <Text as="span" size="xs" tone="subdued">
          +{remaining} more
        </Text>
      )}
    </BlockStack>
  );
}

type MergedIoNodeType = Node<MergedIoNodeData, "mergedIo">;

export function MergedIoNode({ data }: NodeProps<MergedIoNodeType>) {
  const { diff, spotlight } = data;
  const isInput = diff.kind === "input";
  const changedFields = diff.fieldDiffs.filter(
    (entry) => entry.status !== "unchanged",
  );
  const side = spotlight === "b" ? "b" : "a";
  const showSideValues = spotlight !== "both" && changedFields.length > 0;
  const changeSummary =
    diff.status === "changed" ? summarizeIoChange(diff) : "";
  const showFieldChanges =
    !showSideValues &&
    diff.status === "changed" &&
    changedFields.length > 0 &&
    changeSummary !== "source rewired";

  return (
    <BlockStack
      gap="1"
      className={cn(
        "relative w-44 rounded-2xl border-2 px-4 py-2",
        KIND_TINT[isInput ? "input" : "output"],
        MEMBERSHIP_BORDER[diff.status],
      )}
    >
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="2"
        className="w-full"
      >
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <Icon
            name={isInput ? "ArrowRightToLine" : "ArrowRightFromLine"}
            size="xs"
            className="text-muted-foreground"
          />
          <Text
            as="span"
            size="xs"
            tone="subdued"
            weight="semibold"
            className="uppercase"
          >
            {isInput ? "Input" : "Output"}
          </Text>
        </InlineStack>
        <DiffStatusBadge status={diff.status} />
      </InlineStack>

      <Text as="span" size="sm" weight="semibold" className="wrap-break-word">
        {diff.name}
      </Text>
      {showSideValues ? (
        <SideValues fields={changedFields} side={side} />
      ) : showFieldChanges ? (
        <IoFieldChanges fields={changedFields} />
      ) : (
        changeSummary && (
          <Text as="span" size="xs" tone="subdued">
            {changeSummary}
          </Text>
        )
      )}

      {isInput ? (
        <Handle
          type="source"
          position={Position.Right}
          className="border-0! bg-gray-500!"
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="border-0! bg-gray-500!"
        />
      )}
    </BlockStack>
  );
}
