import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import { StatusTab } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/StatusIndicator";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { MergedTaskNodeData } from "@/routes/v2/pages/CompareView/utils/buildMergedGraph";
import type { DiffStatus } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

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

  const componentChanged =
    diff.status === "changed" && !diff.sameComponentVersion;

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
          className="absolute -top-5 left-0 -z-1"
        >
          {statusA && (
            <StatusTab status={statusA} label="A" className="max-w-36" />
          )}
          {statusB && (
            <StatusTab status={statusB} label="B" className="max-w-36" />
          )}
        </InlineStack>
      )}

      <DiffStatusBadge status={diff.status} />

      <Text as="span" size="sm" weight="semibold" className="wrap-break-word">
        {name}
      </Text>
      <Text as="span" size="xs" tone="subdued" className="font-mono break-all">
        {diff.taskId}
      </Text>
      {componentChanged && (
        <Text as="span" size="xs" tone="subdued" className="font-mono">
          {diff.digestA?.slice(0, 8) ?? "—"} →{" "}
          {diff.digestB?.slice(0, 8) ?? "—"}
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
