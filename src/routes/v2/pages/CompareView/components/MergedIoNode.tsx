import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { MergedIoNodeData } from "@/routes/v2/pages/CompareView/utils/buildMergedGraph";
import type { DiffStatus } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

import { DiffStatusBadge } from "./DiffStatusBadge";

const MEMBERSHIP_BORDER: Record<DiffStatus, string> = {
  unchanged: "border-gray-300",
  lost: "border-red-400",
  new: "border-green-500",
  changed: "border-amber-400",
};

type MergedIoNodeType = Node<MergedIoNodeData, "mergedIo">;

export function MergedIoNode({ data }: NodeProps<MergedIoNodeType>) {
  const { diff } = data;
  const isInput = diff.kind === "input";

  return (
    <BlockStack
      gap="1"
      className={cn(
        "relative w-44 rounded-2xl border-2 bg-muted px-4 py-2",
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
