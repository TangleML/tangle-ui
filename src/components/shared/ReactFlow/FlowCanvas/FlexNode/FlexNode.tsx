import { type Node, type NodeProps } from "@xyflow/react";

import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { FlexNodeData } from "./types";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const { properties } = data;
  const { title, content, color } = properties;

  const isTransparent = color === "transparent";

  return (
    <div
      key={id}
      className={cn(
        "p-1 rounded-lg border-2 border-transparent h-full w-full",
        isTransparent && !title && !content && "border-dashed border-warning",
        selected && "border-gray-500 border-solid",
      )}
      style={{ backgroundColor: color }}
    >
      <div
        className={cn(
          "rounded-sm p-1 h-full w-full overflow-hidden",
          isTransparent ? "bg-transparent" : "bg-white/40",
        )}
      >
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
