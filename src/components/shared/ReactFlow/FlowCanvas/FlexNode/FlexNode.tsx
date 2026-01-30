import { type Node, type NodeProps } from "@xyflow/react";

import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { FlexNodeData } from "./types";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const { properties } = data;
  const { title, content, color, zIndex } = properties;

  return (
    <div
      key={id}
      className={cn(
        "p-1 rounded-lg border border-gray-200 h-full w-full",
        selected && "ring-2 ring-gray-500",
      )}
      style={{ backgroundColor: color, zIndex }}
    >
      <div className="rounded-sm bg-white/40 p-1 h-full w-full">
        <BlockStack gap="1">
          <Paragraph size="sm" weight="semibold">
            {title}
          </Paragraph>
          <Paragraph size="xs">{content}</Paragraph>
        </BlockStack>
      </div>
    </div>
  );
};

export default FlexNode;
