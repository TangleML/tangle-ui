import { Handle, Position } from "@xyflow/react";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  deriveColorPalette,
  getContrastTextColor,
} from "@/routes/v2/shared/nodes/TaskNode/color.utils";

import type { TaskNodeViewProps } from "./TaskNode";
import { createTaskNodeCardVariants } from "./taskNode.variants";

const PERCEIVED_FONT_SIZE = "28px";
const s = "var(--simplified-scale, 1)";

const simplifiedCardVariants = createTaskNodeCardVariants(
  "flex flex-col justify-center rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer select-none transition-[border-color,box-shadow]",
);

export function TaskNodeSimplified({
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
      className={simplifiedCardVariants({
        selected,
        hovered: isHovered,
        subgraph: isSubgraph,
      })}
      style={{
        width: `calc(${s} * 240px)`,
        height: `calc(${s} * 96px)`,
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
          className="bg-gray-500! border-0!"
        />
      ))}

      <div
        className="flex items-center w-full h-full"
        style={{
          padding: `calc(${s} * 14px) calc(${s} * 18px)`,
          gap: `calc(${s} * 10px)`,
        }}
      >
        {isSubgraph && (
          <div
            className="shrink-0"
            style={{
              width: `calc(${s} * 32px)`,
              height: `calc(${s} * 32px)`,
              ...(taskColor ? { color: headerTextColor } : {}),
            }}
          >
            <Icon
              name="Workflow"
              className={cn("h-full! w-full!", !taskColor && "text-blue-600")}
            />
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "font-medium min-w-0 line-clamp-2 wrap-break-word",
                !taskColor && "text-slate-900",
              )}
              style={{
                fontSize: `calc(${s} * ${PERCEIVED_FONT_SIZE})`,
                lineHeight: 1.25,
              }}
            >
              {taskName}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{taskName}</TooltipContent>
        </Tooltip>
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
          className="bg-gray-500! border-0!"
        />
      ))}
    </Card>
  );
}
