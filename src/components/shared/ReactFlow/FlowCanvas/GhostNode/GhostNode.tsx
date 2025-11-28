import { type Node, type NodeProps, Position } from "@xyflow/react";
import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";

import IONode from "../IONode/IONode";
import type { GhostNodeData } from "./types";
import { GHOST_NODE_BASE_OFFSET_X, GHOST_NODE_BASE_OFFSET_Y } from "./utils";

type GhostNodeProps = NodeProps<Node<GhostNodeData>>;

const GhostNode = ({ data, id }: GhostNodeProps) => {
  const { ioType, label, dataType, value, defaultValue } = data;

  const side = ioType === "input" ? Position.Left : Position.Right;
  const transformOrigin =
    side === Position.Left ? "center right" : "center left";
  const offsetX = GHOST_NODE_BASE_OFFSET_X;
  const offsetY = GHOST_NODE_BASE_OFFSET_Y;

  const ghostNodeData = useMemo(
    () => ({
      label,
      type: dataType ?? "any",
      value,
      default: defaultValue,
      readOnly: true,
    }),
    [label, dataType, value, defaultValue],
  );

  return (
    <div
      className={cn(
        "pointer-events-none select-none opacity-60",
        side === Position.Left && "-translate-x-full",
      )}
      style={{
        filter: "brightness(0.9) saturate(0.7)",
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        transformOrigin,
      }}
    >
      <div className="rounded-lg border-2 border-dashed border-blue-400/60 bg-white/40 p-1">
        <IONode
          id={id}
          type={ioType}
          data={ghostNodeData}
          selected={false}
          deletable={false}
        />
      </div>
    </div>
  );
};

export default memo(GhostNode);
