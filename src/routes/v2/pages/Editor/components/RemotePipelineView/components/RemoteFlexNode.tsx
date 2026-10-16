import type { Node, NodeProps } from "@xyflow/react";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import { cn } from "@/lib/utils";

export function RemoteFlexNode({ data }: NodeProps<Node<FlexNodeData>>) {
  const {
    title,
    content,
    color,
    borderColor,
    titleFontSize = 12,
    contentFontSize = 10,
  } = data.properties;
  return (
    <div
      className={cn(
        "h-full w-full rounded-lg p-2 overflow-hidden",
        color === "transparent" ? "border-2 text-foreground" : "text-ink-fixed",
      )}
      style={{ backgroundColor: color, borderColor }}
    >
      {title && (
        <p
          className="font-bold whitespace-pre-wrap"
          style={{ fontSize: titleFontSize }}
        >
          {title}
        </p>
      )}
      {content && (
        <p
          className="whitespace-pre-wrap"
          style={{ fontSize: contentFontSize }}
        >
          {content}
        </p>
      )}
    </div>
  );
}
