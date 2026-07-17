import { Handle, Position } from "@xyflow/react";
import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";
import { type MouseEvent as ReactMouseEvent, useEffect, useState } from "react";

import { PublishedComponentBadge } from "@/components/shared/ManageComponent/PublishedComponentBadge";
import { trimDigest } from "@/components/shared/ManageComponent/utils/digest";
import { OutputTypeSelector } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/OutputTypeSelector/OutputTypeSelector";
import TaskStatusBar from "@/components/shared/Status/TaskStatusBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { AGGREGATOR_ADD_INPUT_HANDLE_ID } from "@/utils/aggregatorInputs";
import { pluralize } from "@/utils/string";

import { deriveColorPalette } from "./color.utils";
import { InputAggregatorHandle } from "./InputAggregatorHandle";
import type { TaskNodeInput, TaskNodeViewProps } from "./TaskNode";

const AGGREGATOR_INTERNAL_INPUTS = new Set([
  AGGREGATOR_ADD_INPUT_HANDLE_ID,
  "output_type",
]);

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
        className:
          "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/25",
      },
      {
        selected: false,
        hovered: true,
        className: "border-amber-400",
      },
      {
        selected: true,
        className: "ring-4 ring-edge-selected/60",
      },
    ],
    defaultVariants: {
      selected: false,
      hovered: false,
    },
  },
);

const classicInputLabelVariants = cva("text-xs rounded-md px-2 py-1 truncate", {
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
});

interface ClassicInputHandleProps {
  input: TaskNodeInput;
  entityId: string;
  displayValue: string | undefined;
  hideValue?: boolean;
  isSecret: boolean;
  /** When true the node has no custom colour, so section chrome follows the theme. */
  themed: boolean;
  /** Whether the app is in dark mode — used to darken coloured-node chrome. */
  isDark: boolean;
  onInputClick: (name: string, event: ReactMouseEvent) => void;
  onHandleClick: (handleId: string, event: ReactMouseEvent) => void;
}

const ClassicInputHandle = observer(function ClassicInputHandle({
  input,
  entityId,
  displayValue,
  hideValue,
  isSecret,
  themed,
  isDark,
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
  const showValueDisplay = !hideValue && (hasValue || hasDefault);
  const labelHasValue = hideValue ? true : hasValue;
  const labelHasDefault = hideValue ? false : hasDefault;

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
            !showValueDisplay ? "max-w-full" : "max-w-3/4",
          )}
        >
          <div
            className={cn(
              classicInputLabelVariants({
                hasValue: labelHasValue,
                hasDefault: labelHasDefault,
                optional: input.optional ?? false,
              }),
              themed
                ? "text-foreground bg-muted hover:bg-accent"
                : isDark
                  ? "text-gray-100 bg-white/10 hover:bg-white/15"
                  : "text-gray-800 bg-black/5 hover:bg-black/10",
            )}
            title={`${input.name}${input.type ? `: ${input.type}` : ""}`}
          >
            {input.name.replace(/_/g, " ")}
          </div>
        </div>
        {showValueDisplay && (
          <div className="flex w-fit max-w-1/2 min-w-0 items-center gap-1">
            {isSecret && (
              <Icon
                name="Lock"
                size="xs"
                className="shrink-0 text-amber-600"
                aria-hidden="true"
                data-testid={`input-secret-icon-${input.name}`}
              />
            )}
            <div
              className={cn(
                "text-xs truncate inline-block text-right pr-2",
                themed
                  ? "text-foreground"
                  : isDark
                    ? "text-gray-100"
                    : "text-gray-800",
                !hasValue &&
                  (themed
                    ? "text-muted-foreground italic"
                    : "text-gray-400 italic"),
                isSecret && "text-amber-600",
              )}
            >
              {isSecret && <span className="sr-only">Secret: </span>}
              {hasValue ? displayValue : input.default}
            </div>
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
  secretInputNames,
  onNodeClick,
  onInputClick,
  onOutputClick,
  onHandleClick,
  taskColor,
  cacheDisabled,
  componentRef,
  digest,
  publishedComponentBadgeReadOnly,
  isAggregator,
  outputType,
  subgraphExecutionStats,
  onOutputTypeChange,
}: TaskNodeViewProps) {
  const isDark = useTheme().resolvedTheme === "dark";
  const palette = taskColor ? deriveColorPalette(taskColor, isDark) : undefined;
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

  const filteredInputs = isAggregator
    ? inputs.filter((input) => !AGGREGATOR_INTERNAL_INPUTS.has(input.name))
    : inputs;

  const condensedInputs =
    filteredInputs.length > 0 && connectedInputNames.size > 0
      ? filteredInputs.filter((input) => connectedInputNames.has(input.name))
      : filteredInputs.slice(0, 1);
  const hiddenInputCount = filteredInputs.length - condensedInputs.length;
  const showCondensedInputs =
    !isAggregator && collapsed && !inputsExpanded && hiddenInputCount > 0;
  const visibleInputs = showCondensedInputs ? condensedInputs : filteredInputs;
  const showInputsSection = filteredInputs.length > 0 || isAggregator;

  const condensedOutputs =
    outputs.length > 0 && connectedOutputNames.size > 0
      ? outputs.filter((output) => connectedOutputNames.has(output.name))
      : outputs.slice(0, 1);
  const hiddenOutputCount = outputs.length - condensedOutputs.length;
  const showCondensedOutputs =
    collapsed && !outputsExpanded && hiddenOutputCount > 0;
  const visibleOutputs = showCondensedOutputs ? condensedOutputs : outputs;
  const digestMarkup = digest ? (
    <span
      className={cn(
        "text-xs font-light font-mono shrink-0",
        !componentRef && !palette && "text-muted-foreground",
      )}
      style={!componentRef && palette ? { color: palette.text } : undefined}
    >
      {trimDigest(digest)}
    </span>
  ) : null;

  return (
    <Card
      className={cardVariants({
        selected,
        hovered: isHovered,
      })}
      style={cardStyle}
      onClick={onNodeClick}
      data-tour-card="task"
      data-tour-card-name={taskName}
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
                  !taskColor && "text-card-foreground",
                )}
                style={palette ? { color: palette.text } : undefined}
              >
                {taskName}
              </CardTitle>
            </InlineStack>
            {digestMarkup && componentRef ? (
              <PublishedComponentBadge
                componentRef={componentRef}
                readOnly={publishedComponentBadgeReadOnly}
              >
                {digestMarkup}
              </PublishedComponentBadge>
            ) : (
              digestMarkup
            )}
          </InlineStack>
        </BlockStack>
      </CardHeader>

      <CardContent className="p-2 flex flex-col gap-2">
        {isSubgraph && subgraphExecutionStats && (
          <TaskStatusBar executionStatusStats={subgraphExecutionStats} />
        )}
        {showInputsSection && (
          <div
            className={cn(
              "p-2 rounded-lg",
              !palette && "bg-muted",
              !isAggregator &&
                collapsed &&
                hiddenInputCount > 0 &&
                "cursor-pointer",
              !palette &&
                !isAggregator &&
                collapsed &&
                hiddenInputCount > 0 &&
                "hover:bg-accent",
            )}
            style={palette ? { backgroundColor: palette.sectionBg } : undefined}
            onClickCapture={
              !isAggregator && collapsed && hiddenInputCount > 0
                ? (e) => {
                    e.stopPropagation();
                    setInputsExpanded((prev) => !prev);
                  }
                : undefined
            }
          >
            <BlockStack gap="3">
              {isAggregator && <InputAggregatorHandle />}
              {visibleInputs.map((input, index) => (
                <ClassicInputHandle
                  key={input.name}
                  input={input}
                  entityId={entityId}
                  themed={!palette}
                  isDark={isDark}
                  displayValue={
                    showCondensedInputs
                      ? index === 0
                        ? `+${hiddenInputCount} more ${pluralize(hiddenInputCount, "input")}`
                        : undefined
                      : inputDisplayValues[input.name]
                  }
                  hideValue={showCondensedInputs && index !== 0}
                  isSecret={secretInputNames.has(input.name)}
                  onInputClick={onInputClick}
                  onHandleClick={onHandleClick}
                />
              ))}
              {collapsed && inputsExpanded && hiddenInputCount > 0 && (
                <span
                  className={cn(
                    "text-xs text-center",
                    palette ? "text-gray-400" : "text-muted-foreground",
                  )}
                >
                  (Click to collapse)
                </span>
              )}
            </BlockStack>
          </div>
        )}

        {(outputs.length > 0 || isAggregator) && (
          <div
            className={cn(
              "p-2 rounded-lg",
              !palette && "bg-muted",
              collapsed && hiddenOutputCount > 0 && "cursor-pointer",
              !palette &&
                collapsed &&
                hiddenOutputCount > 0 &&
                "hover:bg-accent",
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
              {isAggregator && (
                <div className="w-full">
                  <OutputTypeSelector
                    value={outputType}
                    onChange={onOutputTypeChange}
                  />
                </div>
              )}
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
                      <div
                        className={cn(
                          "text-xs italic px-2",
                          palette
                            ? isDark
                              ? "text-gray-300"
                              : "text-gray-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {`+${hiddenOutputCount} more ${pluralize(hiddenOutputCount, "output")}`}
                      </div>
                    )}
                    <div className="translate-x-3 min-w-0 inline-block max-w-full">
                      <div
                        className={cn(
                          "text-xs rounded-md px-2 py-1 truncate",
                          palette
                            ? isDark
                              ? "text-gray-100 bg-white/10 hover:bg-white/15"
                              : "text-gray-800 bg-black/5 hover:bg-black/10"
                            : "text-foreground bg-muted hover:bg-accent",
                        )}
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
                <span
                  className={cn(
                    "text-xs text-center",
                    palette ? "text-gray-400" : "text-muted-foreground",
                  )}
                >
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
