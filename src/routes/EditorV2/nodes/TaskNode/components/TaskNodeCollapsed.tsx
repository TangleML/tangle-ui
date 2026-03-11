import { Handle, Position, useStore } from "@xyflow/react";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { getContrastTextColor } from "@/utils/color";

import type { TaskNodeViewProps } from "./TaskNode";
import { ZOOM_THRESHOLD } from "./TaskNode";

const zoomValueSelector = (s: { transform: [number, number, number] }) =>
  s.transform[2];

const MAX_SCALE = 7;

export function TaskNodeCollapsed({
  taskName,
  inputs,
  outputs,
  isSubgraph,
  selected,
  isHovered,
  taskColor,
  onNodeClick,
}: TaskNodeViewProps) {
  const zoom = useStore(zoomValueSelector);
  const scale = Math.min(ZOOM_THRESHOLD / zoom, MAX_SCALE);
  const headerTextColor = taskColor
    ? getContrastTextColor(taskColor)
    : undefined;

  const fontSize = 32 * scale;
  const iconSize = 16 * scale;
  const padding = 12 * scale;
  const gap = 8 * scale;
  const handleSize = 12 * scale;

  return (
    <Card
      className={cn(
        "flex flex-col justify-center rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer transition-[border-color,box-shadow]",
        selected
          ? "border-blue-500 ring-2 ring-blue-200"
          : isHovered
            ? "ring-2 ring-amber-300 border-amber-400"
            : isSubgraph
              ? "border-purple-300 hover:border-purple-400"
              : "border-gray-200 hover:border-gray-300",
      )}
      style={{
        minWidth: 180 * scale,
        maxWidth: 280 * scale,
        minHeight: 100 * scale,
        ...(taskColor
          ? { backgroundColor: taskColor, color: headerTextColor }
          : {}),
      }}
      onClick={onNodeClick}
    >
      {inputs.map((input) => (
        <Handle
          key={input.name}
          type="target"
          position={Position.Left}
          id={`input_${input.name}`}
          style={{
            top: "50%",
            width: handleSize,
            height: handleSize,
            left: -(handleSize / 3),
          }}
          className="!bg-blue-400 !border-2 !border-white"
        />
      ))}

      <div className="flex items-start" style={{ padding, gap }}>
        <div
          className="shrink-0"
          style={{
            width: iconSize,
            height: iconSize,
            marginTop: fontSize * 0.1,
            ...(taskColor ? { color: headerTextColor } : {}),
          }}
        >
          <Icon
            name={isSubgraph ? "Layers" : "Circle"}
            className={cn(
              "!h-full !w-full",
              !taskColor && (isSubgraph ? "text-purple-600" : "text-blue-600"),
            )}
          />
        </div>
        <span
          className={cn(
            "font-semibold break-words min-w-0",
            !taskColor && "text-slate-900",
          )}
          style={{ fontSize, lineHeight: 1.2 }}
        >
          {taskName}
        </span>
      </div>

      {outputs.map((output) => (
        <Handle
          key={output.name}
          type="source"
          position={Position.Right}
          id={`output_${output.name}`}
          style={{
            top: "50%",
            width: handleSize,
            height: handleSize,
            right: -(handleSize / 3),
          }}
          className="!bg-green-400 !border-2 !border-white"
        />
      ))}
    </Card>
  );
}
