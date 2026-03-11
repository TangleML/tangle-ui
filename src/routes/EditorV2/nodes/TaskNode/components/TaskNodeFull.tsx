import { Handle, Position } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { getContrastTextColor } from "@/utils/color";

import { InputValidationIndicator } from "../../../components/InputValidationIndicator";
import type { TaskNodeViewProps } from "./TaskNode";

export function TaskNodeFull({
  entityId,
  taskName,
  selected,
  isHovered,
  isSubgraph,
  description,
  inputs,
  outputs,
  annotations,
  taskColor,
  onNodeClick,
  onInputClick,
}: TaskNodeViewProps) {
  const headerTextColor = taskColor
    ? getContrastTextColor(taskColor)
    : undefined;

  return (
    <Card
      className={cn(
        "min-w-[180px] max-w-[280px] rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer transition-all",
        selected
          ? "border-blue-500 ring-2 ring-blue-200"
          : isHovered
            ? "ring-2 ring-amber-300 border-amber-400"
            : isSubgraph
              ? "border-purple-300 hover:border-purple-400"
              : "border-gray-200 hover:border-gray-300",
      )}
      onClick={onNodeClick}
    >
      <CardHeader
        className={cn(
          "border-b border-slate-200 px-3 py-2",
          taskColor && "rounded-t-[10px]",
        )}
        style={
          taskColor
            ? { backgroundColor: taskColor, color: headerTextColor }
            : undefined
        }
      >
        <InlineStack gap="2" wrap="nowrap" blockAlign="center">
          <span
            className="shrink-0 flex items-center"
            style={taskColor ? { color: headerTextColor } : undefined}
          >
            <Icon
              name={isSubgraph ? "Layers" : "Circle"}
              size="sm"
              className={cn(
                !taskColor &&
                  (isSubgraph ? "text-purple-600" : "text-blue-600"),
              )}
            />
          </span>
          <CardTitle
            className={cn(
              "truncate text-sm font-medium flex-1",
              !taskColor && "text-slate-900",
            )}
          >
            {taskName}
          </CardTitle>
          {isSubgraph && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="shrink-0 bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0"
                >
                  <Icon name="FolderOpen" size="xs" className="mr-0.5" />
                  Subgraph
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <Text size="xs">
                  Double-click to navigate into this subgraph
                </Text>
              </TooltipContent>
            </Tooltip>
          )}
        </InlineStack>
        {description && (
          <Text
            size="xs"
            tone={taskColor ? undefined : "subdued"}
            className={cn("truncate mt-1", taskColor && "opacity-80")}
            title={description}
          >
            {description}
          </Text>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <InlineStack className="divide-x divide-slate-100">
          <BlockStack className="flex-1 py-2 px-1 min-w-0">
            {inputs.length > 0 ? (
              inputs.map((input) => (
                <div
                  key={input.name}
                  className="relative flex items-center py-0.5 px-2 hover:bg-blue-50 rounded cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInputClick(input.name, e);
                  }}
                >
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`input_${input.name}`}
                    className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white !-left-1"
                  />
                  <Text
                    size="xs"
                    tone="subdued"
                    className={cn(
                      "truncate",
                      input.optional && "italic opacity-70",
                    )}
                    title={`${input.name}${input.type ? `: ${input.type}` : ""}`}
                  >
                    {input.name}
                  </Text>
                  <InputValidationIndicator
                    entityId={entityId}
                    inputName={input.name}
                    className="ml-0.5"
                  />
                </div>
              ))
            ) : (
              <Text size="xs" tone="subdued" className="px-2 opacity-50">
                No inputs
              </Text>
            )}
          </BlockStack>

          <BlockStack className="flex-1 py-2 px-1 min-w-0">
            {outputs.length > 0 ? (
              outputs.map((output) => (
                <div
                  key={output.name}
                  className="relative flex items-center justify-end py-0.5 px-2"
                >
                  <Text
                    size="xs"
                    tone="subdued"
                    className="truncate"
                    title={`${output.name}${output.type ? `: ${output.type}` : ""}`}
                  >
                    {output.name}
                  </Text>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`output_${output.name}`}
                    className="!w-2.5 !h-2.5 !bg-green-400 !border-2 !border-white !-right-1"
                  />
                </div>
              ))
            ) : (
              <Text
                size="xs"
                tone="subdued"
                className="px-2 opacity-50 text-right"
              >
                No outputs
              </Text>
            )}
          </BlockStack>
        </InlineStack>

        {annotations.length > 0 && (
          <BlockStack className="border-t rounded-b-md border-slate-100 px-3 py-1.5 bg-slate-50 overflow-hidden">
            <Text size="xs" tone="subdued" className="font-mono truncate">
              annotations: [{annotations.map((a) => a.key).join(", ")}]
            </Text>
          </BlockStack>
        )}
      </CardContent>
    </Card>
  );
}
