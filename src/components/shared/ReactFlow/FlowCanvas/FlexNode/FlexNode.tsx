import { type Node, type NodeProps } from "@xyflow/react";

import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { FlexNodeData } from "./types";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const color = data.color || "yellow-200";
  const border = data.border || "yellow-400";

  return (
    <div
      key={id}
      className={cn(
        "p-1 rounded-lg border h-full w-full",
        selected && "ring-2 ring-offset-2 ring-yellow-400",
      )}
      style={{ borderColor: border, backgroundColor: color }}
    >
      <div className="rounded-sm bg-white/40 p-1 h-full w-full">
        <Paragraph size="sm" weight="semibold" className="mb-1">
          {data.title}
        </Paragraph>
        {data.content}
      </div>
    </div>
  );
};

export default FlexNode;
