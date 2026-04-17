import { Handle, Position } from "@xyflow/react";
import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";

import { trimDigest } from "@/components/shared/ManageComponent/utils/digest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

import type { TaskNodeInput, TaskNodeViewProps } from "./TaskNode";

const cardVariants = cva(
  "min-w-[300px] max-w-[350px] rounded-2xl border-2 p-0 drop-shadow-none cursor-pointer select-none gap-2",
  {
    variants: {
      selected: { true: "", false: "" },
      hovered: { true: "", false: "" },
    },
    compoundVariants: [
      {
        selected: false,
        hovered: false,
        className: "border-gray-200 hover:border-slate-200",
      },
      {
        selected: false,
        hovered: true,
        className: "border-amber-400",
      },
      {
        selected: true,
        className: "border-gray-500",
      },
    ],
    defaultVariants: {
      selected: false,
      hovered: false,
    },
  },
);

const classicInputLabelVariants = cva(
  "text-xs text-gray-800 rounded-md px-2 py-1 truncate bg-gray-200 hover:bg-gray-300",
  {
    variants: {
      hasValue: { true: "", false: "" },
      hasDefault: { true: "", false: "" },
      optional: { true: "", false: "" },
    },
    compoundVariants: [
      {
        hasValue: false,
        hasDefault: true,
        className: "opacity-50 italic",
      },
      {
        hasValue: false,
        hasDefault: false,
        optional: true,
        className: "opacity-50 italic",
      },
    ],
    defaultVariants: {
      hasValue: false,
      hasDefault: false,
      optional: false,
    },
  },
);

interface ClassicInputHandleProps {
  input: TaskNodeInput;
  entityId: string;
  displayValue: string | undefined;
  onInputClick: (name: string, event: React.MouseEvent) => void;
  onHandleClick: (handleId: string, event: React.MouseEvent) => void;
}

const ClassicInputHandle = observer(function ClassicInputHandle({
  input,
  entityId,
  displayValue,
  onInputClick,
  onHandleClick,
}: ClassicInputHandleProps) {
  const spec = useSpec();
  const issues = spec?.issuesByEntityId.get(entityId);
  const hasError = issues?.some(
    (issue) => issue.argumentName === input.name && issue.severity === "error",
  );

  const hasValue = displayValue !== undefined && displayValue !== "";
  const hasDefault = input.default !== undefined && input.default !== "";

  return (
    <div
      className="relative w-full h-fit cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onInputClick(input.name, e);
      }}
    >
      <div className="absolute -translate-x-6 flex items-center h-3 w-3">
        <Handle
          type="target"
          position={Position.Left}
          id={`input_${input.name}`}
          className={
            hasError
              ? "border-0! h-full! w-full! transform-none! bg-red-700!"
              : "border-0! h-full! w-full! transform-none! bg-gray-500!"
          }
          onClick={(e) => onHandleClick(`input_${input.name}`, e)}
        />
      </div>
      <InlineStack
        blockAlign="center"
        className="w-full justify-between gap-0.5 rounded-md cursor-pointer relative"
      >
        <div
          className={cn(
            "flex w-fit min-w-0",
            !hasValue ? "max-w-full" : "max-w-3/4",
          )}
        >
          <div
            className={classicInputLabelVariants({
              hasValue,
              hasDefault,
              optional: input.optional ?? false,
            })}
            title={`${input.name}${input.type ? `: ${input.type}` : ""}`}
          >
            {input.name.replace(/_/g, " ")}
          </div>
        </div>
        {(hasValue || hasDefault) && (
          <div className="flex w-fit max-w-1/2 min-w-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "text-xs text-gray-800 truncate inline-block text-right pr-2",
                    !hasValue && "text-gray-400 italic",
                  )}
                >
                  {hasValue ? displayValue : input.default}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {hasValue ? displayValue : input.default}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </InlineStack>
    </div>
  );
});

export const TaskNodeClassic = observer(function TaskNodeClassic({
  entityId,
  taskName,
  selected,
  isHovered,
  isSubgraph,
  inputs,
  outputs,
  inputDisplayValues,
  onNodeClick,
  onInputClick,
  onOutputClick,
  onHandleClick,
  taskColor,
  cacheDisabled,
  digest,
}: TaskNodeViewProps) {
  const cardStyle = taskColor ? { backgroundColor: taskColor } : undefined;

  return (
    <Card
      className={cardVariants({
        selected,
        hovered: isHovered,
      })}
      style={cardStyle}
      onClick={onNodeClick}
    >
      <CardHeader
        className="px-4 py-5"
        style={taskColor ? { borderBottomColor: `${taskColor}30` } : undefined}
      >
        <BlockStack>
          <InlineStack
            gap="2"
            wrap="nowrap"
            blockAlign="center"
            align="space-between"
            className="w-full"
          >
            <InlineStack
              gap="2"
              wrap="nowrap"
              blockAlign="center"
              className="min-w-0"
            >
              {isSubgraph && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Icon
                        name="Workflow"
                        size="sm"
                        className="text-blue-600"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Subgraph</TooltipContent>
                </Tooltip>
              )}
              {cacheDisabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Icon
                        name="ZapOff"
                        size="sm"
                        className="text-orange-400"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Cache Disabled</TooltipContent>
                </Tooltip>
              )}
              <CardTitle
                className={cn(
                  "wrap-anywhere max-w-full text-left text-xs",
                  !taskColor && "text-slate-900",
                )}
              >
                {taskName}
              </CardTitle>
            </InlineStack>
            {digest && (
              <span className="text-xs font-light font-mono text-gray-500 shrink-0 bg-white/60 rounded px-1">
                {trimDigest(digest)}
              </span>
            )}
          </InlineStack>
        </BlockStack>
      </CardHeader>

      <CardContent className="p-2 flex flex-col gap-2">
        {inputs.length > 0 && (
          <BlockStack
            gap="3"
            className="p-2 bg-gray-100 border border-gray-200 rounded-lg"
          >
            {inputs.map((input) => (
              <ClassicInputHandle
                key={input.name}
                input={input}
                entityId={entityId}
                displayValue={inputDisplayValues[input.name]}
                onInputClick={onInputClick}
                onHandleClick={onHandleClick}
              />
            ))}
          </BlockStack>
        )}

        {outputs.length > 0 && (
          <BlockStack
            gap="3"
            className="p-2 bg-gray-100 border border-gray-200 rounded-lg"
          >
            {outputs.map((output) => (
              <div
                key={output.name}
                className="flex items-center justify-end w-full cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onOutputClick(output.name, e);
                }}
              >
                <div className="flex flex-row-reverse w-full gap-0.5 items-center justify-between">
                  <div className="translate-x-3 min-w-0 inline-block max-w-full">
                    <div
                      className="text-xs text-gray-800 rounded-md px-2 py-1 truncate bg-gray-200 hover:bg-gray-300"
                      title={`${output.name}${output.type ? `: ${output.type}` : ""}`}
                    >
                      {output.name.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output_${output.name}`}
                  className="relative! border-0! w-3! h-3! transform-none! translate-x-6 bg-gray-500!"
                  onClick={(e) => onHandleClick(`output_${output.name}`, e)}
                />
              </div>
            ))}
          </BlockStack>
        )}
      </CardContent>
    </Card>
  );
});
