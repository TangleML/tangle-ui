import { Handle, Position } from "@xyflow/react";

import TaskStatusBar from "@/components/shared/Status/TaskStatusBar";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";
import { deriveColorPalette } from "@/routes/v2/shared/nodes/TaskNode/color.utils";
import { AGGREGATOR_ADD_INPUT_HANDLE_ID } from "@/utils/aggregatorInputs";

import type { TaskNodeViewProps } from "./TaskNode";
import { createTaskNodeCardVariants } from "./taskNode.variants";

const AGGREGATOR_INTERNAL_INPUTS = new Set([
  AGGREGATOR_ADD_INPUT_HANDLE_ID,
  "output_type",
]);

const PERCEIVED_FONT_SIZE = "32px";
const s = "var(--simplified-scale, 1)";

const simplifiedCardVariants = createTaskNodeCardVariants(
  "relative flex flex-col justify-center rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer select-none transition-[border-color,box-shadow]",
);

export function TaskNodeSimplified({
  taskName,
  inputs,
  outputs,
  isSubgraph,
  selected,
  isHovered,
  taskColor,
  isAggregator,
  subgraphExecutionStats,
  onNodeClick,
}: TaskNodeViewProps) {
  const isDark = useTheme().resolvedTheme === "dark";
  const palette = taskColor ? deriveColorPalette(taskColor, isDark) : undefined;
  const headerTextColor = palette?.text;
  const showSubgraphProgress = isSubgraph && !!subgraphExecutionStats;

  const visibleInputs = isAggregator
    ? inputs.filter((input) => !AGGREGATOR_INTERNAL_INPUTS.has(input.name))
    : inputs;

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
        ...(palette
          ? {
              backgroundColor: palette.background,
              color: headerTextColor,
              borderColor: palette.border,
            }
          : {}),
      }}
      onClick={onNodeClick}
      data-tour-card="task"
      data-tour-card-name={taskName}
    >
      {visibleInputs.map((input) => (
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
      {isAggregator && (
        <Handle
          type="target"
          position={Position.Left}
          id={AGGREGATOR_ADD_INPUT_HANDLE_ID}
          style={{
            top: "50%",
            width: `calc(${s} * 12px)`,
            height: `calc(${s} * 12px)`,
            left: `calc(${s} * -4px)`,
          }}
          className="bg-blue-400! border-0!"
        />
      )}

      <div
        className="flex items-center w-full h-full"
        style={{
          padding: showSubgraphProgress
            ? `calc(${s} * 10px) calc(${s} * 18px) calc(${s} * 26px)`
            : `calc(${s} * 14px) calc(${s} * 18px)`,
          gap: `calc(${s} * 10px)`,
        }}
      >
        {isSubgraph && (
          <div
            className="shrink-0"
            style={{
              width: `calc(${s} * 32px)`,
              height: `calc(${s} * 32px)`,
              ...(palette ? { color: headerTextColor } : {}),
            }}
          >
            <Icon
              name="Workflow"
              className={cn("h-full! w-full!", !palette && "text-blue-600")}
            />
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "font-medium min-w-0 wrap-break-word",
                showSubgraphProgress ? "line-clamp-1" : "line-clamp-2",
                !palette && "text-card-foreground",
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

      {showSubgraphProgress && (
        <div
          className="absolute"
          style={{
            left: `calc(${s} * 18px)`,
            right: `calc(${s} * 18px)`,
            bottom: `calc(${s} * 10px)`,
          }}
        >
          <TaskStatusBar
            executionStatusStats={subgraphExecutionStats}
            barClassName="h-[calc(var(--simplified-scale,1)*8px)]"
          />
        </div>
      )}

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
