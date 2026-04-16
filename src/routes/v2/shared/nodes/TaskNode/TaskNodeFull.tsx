import { Handle, Position } from "@xyflow/react";
import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";
import type { MouseEvent } from "react";

import { trimDigest } from "@/components/shared/ManageComponent/utils/digest";
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
import { getContrastTextColor } from "@/routes/v2/shared/nodes/TaskNode/color.utils";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

import type {
  TaskNodeInput,
  TaskNodeOutput,
  TaskNodeViewProps,
} from "./TaskNode";
import { createTaskNodeCardVariants } from "./taskNode.variants";

const fullCardVariants = createTaskNodeCardVariants(
  "min-w-[180px] max-w-[280px] rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer transition-all select-none",
);

const iconVariants = cva("", {
  variants: {
    hasColor: { true: "", false: "" },
    isSubgraph: { true: "", false: "" },
  },
  compoundVariants: [
    { hasColor: false, isSubgraph: true, className: "text-purple-600" },
    { hasColor: false, isSubgraph: false, className: "text-blue-600" },
  ],
  defaultVariants: { hasColor: false, isSubgraph: false },
});

const inputTextVariants = cva("truncate", {
  variants: {
    optional: { true: "italic opacity-70", false: "" },
  },
  defaultVariants: { optional: false },
});

const headerVariants = cva("border-b border-slate-200 px-3 py-2", {
  variants: {
    hasColor: { true: "rounded-t-[10px]", false: "" },
  },
  defaultVariants: { hasColor: false },
});

const titleVariants = cva("truncate text-sm font-medium flex-1", {
  variants: {
    hasColor: { true: "", false: "text-slate-900" },
  },
  defaultVariants: { hasColor: false },
});

const descriptionVariants = cva("truncate mt-1", {
  variants: {
    hasColor: { true: "opacity-80", false: "" },
  },
  defaultVariants: { hasColor: false },
});

interface TaskNodeHeaderProps {
  taskName: string;
  isSubgraph: boolean;
  description: string;
  taskColor: string | undefined;
  cacheDisabled: boolean;
  digest?: string;
}

function TaskNodeHeader({
  taskName,
  isSubgraph,
  description,
  taskColor,
  cacheDisabled,
  digest,
}: TaskNodeHeaderProps) {
  const hasColor = !!taskColor;
  const colorStyle = taskColor
    ? { backgroundColor: taskColor, color: getContrastTextColor(taskColor) }
    : undefined;

  return (
    <CardHeader className={headerVariants({ hasColor })} style={colorStyle}>
      <InlineStack gap="2" wrap="nowrap" blockAlign="center">
        {/* Raw span required: dynamic task color needs inline style which InlineStack doesn't accept */}
        <span
          className="shrink-0 flex items-center"
          style={colorStyle ? { color: colorStyle.color } : undefined}
        >
          <Icon
            name={isSubgraph ? "Layers" : "Circle"}
            size="sm"
            className={iconVariants({ hasColor, isSubgraph })}
          />
        </span>
        <CardTitle className={titleVariants({ hasColor })}>
          {taskName}
        </CardTitle>
        {digest && (
          <span
            className={cn(
              "text-xs font-light font-mono shrink-0",
              hasColor ? "opacity-70" : "text-gray-400",
            )}
          >
            {trimDigest(digest)}
          </span>
        )}
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
              Double-click to navigate into this subgraph
            </TooltipContent>
          </Tooltip>
        )}
        {cacheDisabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                <Icon name="ZapOff" size="sm" className="text-orange-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Cache Disabled</TooltipContent>
          </Tooltip>
        )}
      </InlineStack>
      {description && (
        <Text
          size="xs"
          tone={hasColor ? undefined : "subdued"}
          className={descriptionVariants({ hasColor })}
          title={description}
        >
          {description}
        </Text>
      )}
    </CardHeader>
  );
}

interface InputListProps {
  entityId: string;
  inputs: TaskNodeInput[];
  onInputClick: (name: string, e: MouseEvent) => void;
  onHandleClick: (handleId: string, e: MouseEvent) => void;
}

const InputList = observer(function InputList({
  entityId,
  inputs,
  onInputClick,
  onHandleClick,
}: InputListProps) {
  const spec = useSpec();
  const issues = spec?.issuesByEntityId.get(entityId);

  function hasError(inputName: string) {
    if (!issues) return false;
    return issues.some(
      (issue) => issue.argumentName === inputName && issue.severity === "error",
    );
  }

  if (inputs.length === 0) {
    return (
      <Text size="xs" tone="subdued" className="px-2 opacity-50">
        No inputs
      </Text>
    );
  }

  return inputs.map((input) => (
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
        className={
          hasError(input.name)
            ? "w-2.5! h-2.5! bg-red-700! border-2! border-white! -left-1!"
            : "w-2.5! h-2.5! bg-blue-400! border-2! border-white! -left-1!"
        }
        onClick={(e) => onHandleClick(`input_${input.name}`, e)}
      />
      <Text
        size="xs"
        tone="subdued"
        className={inputTextVariants({ optional: !!input.optional })}
        title={`${input.name}${input.type ? `: ${input.type}` : ""}`}
      >
        {input.name}
      </Text>
    </div>
  ));
});

function OutputList({
  outputs,
  onOutputClick,
  onHandleClick,
}: {
  outputs: TaskNodeOutput[];
  onOutputClick: (name: string, e: MouseEvent) => void;
  onHandleClick: (handleId: string, e: MouseEvent) => void;
}) {
  if (outputs.length === 0) {
    return (
      <Text size="xs" tone="subdued" className="px-2 opacity-50 text-right">
        No outputs
      </Text>
    );
  }

  return outputs.map((output) => (
    <div
      key={output.name}
      className="relative flex items-center justify-end py-0.5 px-2 hover:bg-green-50 rounded cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onOutputClick(output.name, e);
      }}
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
        className="w-2.5! h-2.5! bg-green-400! border-2! border-white! -right-1!"
        onClick={(e) => onHandleClick(`output_${output.name}`, e)}
      />
    </div>
  ));
}

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
  cacheDisabled,
  digest,
  onNodeClick,
  onInputClick,
  onOutputClick,
  onHandleClick,
}: TaskNodeViewProps) {
  return (
    <Card
      className={fullCardVariants({
        selected,
        hovered: isHovered,
        subgraph: isSubgraph,
      })}
      onClick={onNodeClick}
    >
      <TaskNodeHeader
        taskName={taskName}
        isSubgraph={isSubgraph}
        description={description}
        taskColor={taskColor}
        cacheDisabled={cacheDisabled}
        digest={digest}
      />

      <CardContent className="p-0">
        <InlineStack className="divide-x divide-slate-100">
          <BlockStack className="flex-1 py-2 px-1 min-w-0">
            <InputList
              entityId={entityId}
              inputs={inputs}
              onInputClick={onInputClick}
              onHandleClick={onHandleClick}
            />
          </BlockStack>

          <BlockStack className="flex-1 py-2 px-1 min-w-0">
            <OutputList
              outputs={outputs}
              onOutputClick={onOutputClick}
              onHandleClick={onHandleClick}
            />
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
