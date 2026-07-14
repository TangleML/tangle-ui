import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import { StatusTab } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/StatusIndicator";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { QuickTooltip } from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { MergedTaskNodeData } from "@/routes/v2/pages/CompareView/utils/buildMergedGraph";
import type { DiffStatus } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import { summarizeTaskChange } from "@/routes/v2/pages/CompareView/utils/summarizeChange";

import { DiffStatusBadge } from "./DiffStatusBadge";

const MEMBERSHIP_BORDER: Record<DiffStatus, string> = {
  unchanged: "border-gray-300",
  lost: "border-red-400",
  new: "border-green-500",
  changed: "border-amber-400",
};

type MergedTaskNodeType = Node<MergedTaskNodeData, "mergedTask">;

export function MergedTaskNode({ data }: NodeProps<MergedTaskNodeType>) {
  const { diff, spotlight } = data;

  const side = spotlight === "b" ? diff.b : diff.a;
  const name =
    side?.componentRef.spec?.name ??
    diff.a?.componentRef.spec?.name ??
    diff.b?.componentRef.spec?.name ??
    diff.taskId;

  const changeSummary =
    diff.status === "changed" ? summarizeTaskChange(diff) : "";

  const componentChanged =
    diff.status === "changed" && !diff.sameComponentVersion;
  const sideDigest =
    (spotlight === "b" ? diff.digestB : diff.digestA) ??
    diff.digestA ??
    diff.digestB;
  const digestDisplay =
    componentChanged && diff.digestA && diff.digestB
      ? `${diff.digestA.slice(0, 10)} → ${diff.digestB.slice(0, 10)}`
      : sideDigest?.slice(0, 10);

  const cacheDisabled =
    spotlight === "b" ? diff.cacheDisabledB : diff.cacheDisabledA;
  const showCacheIcon = cacheDisabled || diff.cacheChanged;
  const cacheTooltip = diff.cacheChanged
    ? "Cache setting differs between runs"
    : "Caching disabled";

  const statusA = spotlight === "b" ? undefined : diff.statusA;
  const statusB = spotlight === "a" ? undefined : diff.statusB;

  return (
    <BlockStack
      gap="1"
      className={cn(
        "relative w-56 rounded-lg border-2 bg-background px-3 py-2",
        MEMBERSHIP_BORDER[diff.status],
      )}
    >
      {(statusA || statusB) && (
        <InlineStack
          gap="1"
          blockAlign="start"
          wrap="nowrap"
          className="absolute -top-5 left-0 right-0 w-full -z-1"
        >
          {statusA ? (
            <StatusTab status={statusA} label="A" className="min-w-0 flex-1" />
          ) : (
            <div className="flex-1" />
          )}
          {statusB ? (
            <StatusTab status={statusB} label="B" className="min-w-0 flex-1" />
          ) : (
            <div className="flex-1" />
          )}
        </InlineStack>
      )}

      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <DiffStatusBadge status={diff.status} />
        {showCacheIcon && (
          <QuickTooltip content={cacheTooltip}>
            <Icon
              name="ZapOff"
              size="xs"
              className={cn(
                "shrink-0",
                diff.cacheChanged ? "text-amber-500" : "text-orange-500",
              )}
            />
          </QuickTooltip>
        )}
      </InlineStack>

      <Text as="span" size="sm" weight="semibold" className="wrap-break-word">
        {name}
      </Text>
      <Text as="span" size="xs" tone="subdued" className="font-mono break-all">
        {diff.taskId}
      </Text>
      {digestDisplay && (
        <Text
          as="span"
          size="xs"
          tone="subdued"
          className="font-mono break-all"
        >
          {digestDisplay}
        </Text>
      )}
      {changeSummary && (
        <Text as="span" size="xs" tone="subdued">
          {changeSummary}
        </Text>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="border-0! bg-gray-500!"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="border-0! bg-gray-500!"
      />
    </BlockStack>
  );
}
