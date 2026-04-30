import { Handle, Position } from "@xyflow/react";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { IONodeViewProps } from "./IONode";

const PERCEIVED_FONT_SIZE = "28px";
const s = "var(--simplified-scale, 1)";

export function IONodeSimplified({
  entityId,
  name,
  isInput,
  selected,
  isHovered,
  onNodeClick,
}: IONodeViewProps) {
  const bgColor = isInput ? "bg-blue-100" : "bg-violet-100";
  const borderColor = selected
    ? isInput
      ? "border-blue-500"
      : "border-violet-500"
    : isHovered
      ? "border-amber-400 ring-2 ring-amber-300"
      : isInput
        ? "border-blue-300 hover:border-blue-400"
        : "border-violet-300 hover:border-violet-400";

  return (
    <Card
      className={cn(
        "border-2 p-0 cursor-pointer flex flex-row items-center justify-start",
        bgColor,
        borderColor,
      )}
      style={{
        width: `calc(${s} * 220px)`,
        height: `calc(${s} * 80px)`,
        padding: `calc(${s} * 12px) calc(${s} * 16px)`,
        gap: `calc(${s} * 10px)`,
      }}
      onClick={onNodeClick}
    >
      <div
        className="shrink-0"
        style={{
          width: `calc(${s} * 32px)`,
          height: `calc(${s} * 32px)`,
        }}
      >
        <Icon
          name={isInput ? "SquareArrowRightEnter" : "SquareArrowRightExit"}
          className={cn(
            "h-full! w-full!",
            isInput ? "text-blue-600" : "text-violet-600",
          )}
        />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="font-medium min-w-0 line-clamp-2 wrap-break-word text-slate-900 text-left"
            style={{
              fontSize: `calc(${s} * ${PERCEIVED_FONT_SIZE})`,
              lineHeight: 1.25,
            }}
          >
            {name}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{name}</TooltipContent>
      </Tooltip>
      <Handle
        type={isInput ? "source" : "target"}
        position={isInput ? Position.Right : Position.Left}
        id={isInput ? `output_${entityId}` : `input_${entityId}`}
        style={{
          top: "50%",
          width: `calc(${s} * 12px)`,
          height: `calc(${s} * 12px)`,
          ...(isInput
            ? { right: `calc(${s} * -4px)` }
            : { left: `calc(${s} * -4px)` }),
        }}
        className="bg-gray-500! border-0!"
      />
    </Card>
  );
}
