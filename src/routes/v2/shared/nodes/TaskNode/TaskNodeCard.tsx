import { Handle, Position } from "@xyflow/react";
import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";
import { type MouseEvent as ReactMouseEvent, useEffect, useState } from "react";

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
import { pluralize } from "@/utils/string";

import { deriveColorPalette } from "./color.utils";
import type { TaskNodeInput, TaskNodeViewProps } from "./TaskNode";

const cardVariants = cva(
  "min-w-[300px] max-w-[350px] rounded-2xl border-2 p-0 drop-shadow-none cursor-pointer select-none gap-2 transition-shadow",
  {
    variants: {
      selected: { true: "", false: "" },
      hovered: { true: "", false: "" },
    },
    compoundVariants: [
      {
        selected: false,
        hovered: false,
        className: "border-black/10 hover:border-black/30",
      },
      {
        selected: false,
        hovered: true,
        className: "border-amber-400",
      },
      {
        selected: true,
        className: "ring-4 ring-blue-500/60",
      },
    ],
    defaultVariants: {
      selected: false,
      hovered: false,
    },
  },
);

const classicInputLabelVariants = cva(
  "text-xs text-gray-800 rounded-md px-2 py-1 truncate bg-black/5 hover:bg-black/10",
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
  onInputClick: (name: string, event: ReactMouseEvent) => void;
  onHandleClick: (handleId: string, event: ReactMouseEvent) => void;
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

export const TaskNodeCard = observer(function TaskNodeCard({
  entityId,
  taskName,
  selected,
  isHovered,
  isSubgraph,
  collapsed,
  inputs,
  outputs,
  connectedInputNames,
  connectedOutputNames,
  inputDisplayValues,
  onNodeClick,
  onInputClick,
  onOutputClick,
  onHandleClick,
  taskColor,
  cacheDisabled,
  digest,
}: TaskNodeViewProps) {
  const palette = taskColor ? deriveColorPalette(taskColor) : undefined;
  const cardStyle = palette
    ? {
        backgroundColor: palette.background,
        ...(isHovered ? {} : { borderColor: palette.border }),
      }
    : undefined;

  const [inputsExpanded, setInputsExpanded] = useState(false);
  const [outputsExpanded, setOutputsExpanded] = useState(false);

  useEffect(() => {
    if (collapsed) {
      setInputsExpanded(false);
      setOutputsExpanded(false);
    }
  }, [collapsed]);

  const condensedInputs =
    inputs.length > 0 && connectedInputNames.size > 0
      ? inputs.filter((input) => connectedInputNames.has(input.name))
      : inputs.slice(0, 1);
  const hiddenInputCount = inputs.length - condensedInputs.length;
  const showCondensedInputs =
    collapsed && !inputsExpanded && hiddenInputCount > 0;
  const visibleInputs = showCondensedInputs ? condensedInputs : inputs;

  const condensedOutputs =
    outputs.length > 0 && connectedOutputNames.size > 0
      ? outputs.filter((output) => connectedOutputNames.has(output.name))
      : outputs.slice(0, 1);
  const hiddenOutputCount = outputs.length - condensedOutputs.length;
  const showCondensedOutputs =
    collapsed && !outputsExpanded && hiddenOutputCount > 0;
  const visibleOutputs = showCondensedOutputs ? condensedOutputs : outputs;

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
        className="px-4 pt-3 pb-0"
        style={
          palette ? { borderBottomColor: `${palette.border}30` } : undefined
        }
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
                style={palette ? { color: palette.text } : undefined}
              >
                {taskName}
              </CardTitle>
            </InlineStack>
            {digest && (
              <span
                className="text-xs font-light font-mono shrink-0"
                style={{ color: palette?.text ?? "#4b5563" }}
              >
                {trimDigest(digest)}
              </span>
            )}
          </InlineStack>
        </BlockStack>
      </CardHeader>

      <CardContent className="p-2 flex flex-col gap-2">
        {inputs.length > 0 && (
          <div
            className={cn(
              "p-2 rounded-lg",
              !palette && "bg-gray-200/50",
              collapsed &&
                hiddenInputCount > 0 &&
                "cursor-pointer hover:bg-gray-200/80",
            )}
            style={palette ? { backgroundColor: palette.sectionBg } : undefined}
            onClickCapture={
              collapsed && hiddenInputCount > 0
                ? (e) => {
                    e.stopPropagation();
                    setInputsExpanded((prev) => !prev);
                  }
                : undefined
            }
          >
            <BlockStack gap="3">
              {visibleInputs.map((input, index) => (
                <ClassicInputHandle
                  key={input.name}
                  input={input}
                  entityId={entityId}
                  displayValue={
                    showCondensedInputs && index === 0
                      ? `+${hiddenInputCount} more ${pluralize(hiddenInputCount, "input")}`
                      : inputDisplayValues[input.name]
                  }
                  onInputClick={onInputClick}
                  onHandleClick={onHandleClick}
                />
              ))}
              {collapsed && inputsExpanded && hiddenInputCount > 0 && (
                <span className="text-xs text-gray-400 text-center">
                  (Click to collapse)
                </span>
              )}
            </BlockStack>
          </div>
        )}

        {outputs.length > 0 && (
          <div
            className={cn(
              "p-2 rounded-lg",
              !palette && "bg-gray-200/50",
              collapsed &&
                hiddenOutputCount > 0 &&
                "cursor-pointer hover:bg-gray-200/80",
            )}
            style={palette ? { backgroundColor: palette.sectionBg } : undefined}
            onClickCapture={
              collapsed && hiddenOutputCount > 0
                ? (e) => {
                    e.stopPropagation();
                    setOutputsExpanded((prev) => !prev);
                  }
                : undefined
            }
          >
            <BlockStack gap="3">
              {visibleOutputs.map((output, index) => (
                <div
                  key={output.name}
                  className="flex items-center justify-end w-full cursor-pointer"
                  onClick={(e) => {
                    if (collapsed) return;
                    e.stopPropagation();
                    onOutputClick(output.name, e);
                  }}
                >
                  <div className="flex flex-row-reverse w-full gap-0.5 items-center justify-between">
                    {showCondensedOutputs && index === 0 && (
                      <div className="text-xs text-gray-500 italic px-2">
                        {`+${hiddenOutputCount} more ${pluralize(hiddenOutputCount, "output")}`}
                      </div>
                    )}
                    <div className="translate-x-3 min-w-0 inline-block max-w-full">
                      <div
                        className="text-xs text-gray-800 rounded-md px-2 py-1 truncate bg-black/5 hover:bg-black/10"
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
              {collapsed && outputsExpanded && hiddenOutputCount > 0 && (
                <span className="text-xs text-gray-400 text-center">
                  (Click to collapse)
                </span>
              )}
            </BlockStack>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
