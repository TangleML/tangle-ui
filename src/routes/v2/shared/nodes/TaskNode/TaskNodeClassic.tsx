import { Handle, Position } from "@xyflow/react";

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
import { InputValidationIndicator } from "@/routes/v2/shared/components/InputValidationIndicator";

import type { TaskNodeInput, TaskNodeViewProps } from "./TaskNode";

interface ClassicInputHandleProps {
  input: TaskNodeInput;
  entityId: string;
  displayValue: string | undefined;
  onInputClick: (name: string, event: React.MouseEvent) => void;
}

function ClassicInputHandle({
  input,
  entityId,
  displayValue,
  onInputClick,
}: ClassicInputHandleProps) {
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
          className="!border-0 !h-full !w-full !transform-none !bg-gray-500"
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
            className={cn(
              "text-xs text-gray-800 rounded-md px-2 py-1 truncate bg-gray-200 hover:bg-gray-300",
              !hasValue && hasDefault && "opacity-50 italic",
              input.optional && !hasValue && !hasDefault && "opacity-50 italic",
            )}
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
        <InputValidationIndicator entityId={entityId} inputName={input.name} />
      </InlineStack>
    </div>
  );
}

export function TaskNodeClassic({
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
}: TaskNodeViewProps) {
  return (
    <Card
      className={cn(
        "min-w-[300px] max-w-[350px] rounded-2xl border-2 p-0 drop-shadow-none cursor-pointer gap-2",
        selected
          ? "border-gray-500"
          : isHovered
            ? "border-amber-400"
            : isSubgraph
              ? "border-purple-300 hover:border-purple-400"
              : "border-gray-200 hover:border-slate-200",
      )}
      onClick={onNodeClick}
    >
      <CardHeader className="border-b border-slate-200 px-2 py-2.5">
        <BlockStack>
          <InlineStack gap="2" wrap="nowrap" blockAlign="center">
            {isSubgraph && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Icon name="Workflow" size="sm" className="text-blue-600" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <Text size="xs">Subgraph</Text>
                </TooltipContent>
              </Tooltip>
            )}
            <CardTitle className="wrap-anywhere max-w-full text-left text-xs text-slate-900">
              {taskName}
            </CardTitle>
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
              <InlineStack
                key={output.name}
                blockAlign="center"
                className="w-full justify-end"
              >
                <InlineStack
                  blockAlign="center"
                  className="w-full gap-0.5 flex-row-reverse justify-between"
                >
                  <div className="translate-x-3 min-w-0 inline-block max-w-full">
                    <div
                      className="text-xs text-gray-800 rounded-md px-2 py-1 truncate bg-gray-200 hover:bg-gray-300"
                      title={`${output.name}${output.type ? `: ${output.type}` : ""}`}
                    >
                      {output.name.replace(/_/g, " ")}
                    </div>
                  </div>
                </InlineStack>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output_${output.name}`}
                  className="!relative !border-0 !w-3 !h-3 !transform-none !translate-x-6 !bg-gray-500"
                />
              </InlineStack>
            ))}
          </BlockStack>
        )}
      </CardContent>
    </Card>
  );
}
