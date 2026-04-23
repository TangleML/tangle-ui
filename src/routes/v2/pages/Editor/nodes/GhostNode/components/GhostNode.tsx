import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export const GHOST_NODE_ID = "ghost-node";
export const GHOST_HANDLE_ID = "ghost-node-handle";

export const GHOST_OFFSET_X = -12;
export const GHOST_OFFSET_Y = -24;
export const GHOST_ESTIMATED_WIDTH = 140;

export interface GhostNodeData extends Record<string, unknown> {
  ioType: "input" | "output";
  label: string;
  dataType?: string;
}

type GhostNodeType = Node<GhostNodeData, "ghost">;

export const GhostNode = memo(function GhostNode({
  data,
}: NodeProps<GhostNodeType>) {
  const { ioType, label, dataType } = data;

  const isInput = ioType === "input";

  return (
    <div
      className="pointer-events-none select-none opacity-60"
      style={{
        transform: isInput
          ? `translate(calc(${GHOST_OFFSET_X}px - 100%), ${GHOST_OFFSET_Y}px)`
          : `translate(${GHOST_OFFSET_X}px, ${GHOST_OFFSET_Y}px)`,
        filter: "brightness(0.9) saturate(0.7)",
      }}
    >
      <div className="rounded-xl border-2 border-dashed border-blue-400/60 bg-white/40 p-1">
        <Card
          className={cn(
            "min-w-30 max-w-45 rounded-xl border-2 p-0 drop-shadow-sm",
            "border-gray-200",
            isInput ? "bg-blue-50" : "bg-green-50",
          )}
        >
          <CardHeader className="px-3 py-2.5">
            <InlineStack gap="2" wrap="nowrap" blockAlign="center">
              <Icon
                name={isInput ? "Download" : "Upload"}
                size="sm"
                className={cn(
                  "shrink-0",
                  isInput ? "text-blue-500" : "text-green-500",
                )}
              />
              <CardTitle className="truncate text-sm font-medium text-slate-800">
                {label}
              </CardTitle>
            </InlineStack>

            {dataType && (
              <Text size="xs" tone="subdued" className="truncate mt-1">
                {dataType}
              </Text>
            )}
          </CardHeader>

          {isInput && (
            <Handle
              type="source"
              position={Position.Right}
              id={GHOST_HANDLE_ID}
              isConnectableStart={false}
              isConnectableEnd={false}
              className="w-3! h-3! bg-blue-400! border-2! border-white!"
            />
          )}

          {!isInput && (
            <Handle
              type="target"
              position={Position.Left}
              id={GHOST_HANDLE_ID}
              isConnectableStart={false}
              isConnectableEnd={false}
              className="w-3! h-3! bg-green-400! border-2! border-white!"
            />
          )}
        </Card>
      </div>
    </div>
  );
});
