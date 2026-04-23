import { Handle, Position } from "@xyflow/react";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  deriveColorPalette,
  getContrastTextColor,
} from "@/routes/v2/shared/nodes/TaskNode/color.utils";

import type { TaskNodeViewProps } from "./TaskNode";
import { createTaskNodeCardVariants } from "./taskNode.variants";

const s = "var(--collapsed-scale, 1)";

const collapsedCardVariants = createTaskNodeCardVariants(
  "flex flex-col justify-center rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer select-none transition-[border-color,box-shadow]",
);

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
  const palette = taskColor ? deriveColorPalette(taskColor) : undefined;
  const headerTextColor = taskColor
    ? getContrastTextColor(taskColor)
    : undefined;

  return (
    <Card
      className={collapsedCardVariants({
        selected,
        hovered: isHovered,
        subgraph: isSubgraph,
      })}
      style={{
        minWidth: `calc(${s} * 180px)`,
        maxWidth: `calc(${s} * 280px)`,
        minHeight: `calc(${s} * 100px)`,
        ...(taskColor
          ? {
              backgroundColor: taskColor,
              color: headerTextColor,
              borderColor: palette?.border,
            }
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
            width: `calc(${s} * 12px)`,
            height: `calc(${s} * 12px)`,
            left: `calc(${s} * -4px)`,
          }}
          className="!bg-blue-400 !border-2 !border-white"
        />
      ))}

      <div
        className="flex items-start"
        style={{
          padding: `calc(${s} * 12px)`,
          gap: `calc(${s} * 8px)`,
        }}
      >
        <div
          className="shrink-0"
          style={{
            width: `calc(${s} * 16px)`,
            height: `calc(${s} * 16px)`,
            marginTop: `calc(${s} * 3.2px)`,
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
          style={{ fontSize: `calc(${s} * 32px)`, lineHeight: 1.2 }}
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
            width: `calc(${s} * 12px)`,
            height: `calc(${s} * 12px)`,
            right: `calc(${s} * -4px)`,
          }}
          className="!bg-green-400 !border-2 !border-white"
        />
      ))}
    </Card>
  );
}
