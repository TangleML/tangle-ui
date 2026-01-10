import { Handle, Position } from "@xyflow/react";
import { memo, useEffect, useMemo } from "react";

import { InputValueEditor } from "@/components/Editor/IOEditor/InputValueEditor";
import { OutputNameEditor } from "@/components/Editor/IOEditor/OutputNameEditor";
import { getOutputConnectedDetails } from "@/components/Editor/utils/getOutputConnectedDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { getArgumentValue } from "@/utils/nodes/taskArguments";
import { isViewingSubgraph } from "@/utils/subgraphUtils";

import { getGhostHandleId, GHOST_NODE_ID } from "../GhostNode/utils";

export const DEFAULT_IO_NODE_WIDTH = 300;

interface IONodeProps {
  id: string;
  type: "input" | "output";
  data: {
    label: string;
    value?: string;
    default?: string;
    type?: string;
    readOnly?: boolean;
  };
  selected: boolean;
  deletable: boolean;
}

const IONode = ({ id, type, data, selected = false }: IONodeProps) => {
  const { currentGraphSpec, currentSubgraphSpec, currentSubgraphPath } =
    useComponentSpec();

  const executionData = useExecutionDataOptional();
  const taskArguments = executionData?.rootDetails?.task_spec.arguments;

  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();

  const isInput = type === "input";
  const isOutput = type === "output";

  const readOnly = !!data.readOnly;

  const isInSubgraph = isViewingSubgraph(currentSubgraphPath);

  const handleType = isInput ? "source" : "target";
  const handlePosition = isInput ? Position.Right : Position.Left;
  const selectedColor = isInput
    ? "border-blue-500 bg-blue-100"
    : "border-violet-500 bg-violet-100";
  const defaultColor = isInput
    ? "border-blue-300 bg-blue-100"
    : "border-violet-300 bg-violet-100";
  const borderColor = selected ? selectedColor : defaultColor;

  const input = useMemo(
    () =>
      currentSubgraphSpec.inputs?.find((input) => input.name === data.label),
    [currentSubgraphSpec.inputs, data.label],
  );

  const inputTaskArgument = getArgumentValue(taskArguments, input?.name);

  const output = useMemo(
    () =>
      currentSubgraphSpec.outputs?.find((output) => output.name === data.label),
    [currentSubgraphSpec.outputs, data.label],
  );

  useEffect(() => {
    if (selected) {
      if (input && isInput) {
        setContent(
          <InputValueEditor
            input={input}
            key={input.name}
            disabled={readOnly}
            argumentValue={inputTaskArgument}
          />,
        );
      }

      if (output && isOutput) {
        const outputConnectedDetails = getOutputConnectedDetails(
          currentGraphSpec,
          output.name,
        );
        setContent(
          <OutputNameEditor
            output={output}
            connectedDetails={outputConnectedDetails}
            key={output.name}
            disabled={readOnly}
          />,
        );
      }

      setContextPanelOpen(true);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [input, output, selected, readOnly]);

  const connectedOutput = getOutputConnectedDetails(
    currentGraphSpec,
    data.label,
  );
  const outputConnectedValue = connectedOutput.outputName;
  const outputConnectedType = connectedOutput.outputType;
  const outputConnectedTaskId = connectedOutput.taskId;

  const handleDefaultClassName =
    "w-3! h-3! border-0! transform-none! bg-gray-500!";

  const handleClassName = isInput ? "translate-x-1.5" : "-translate-x-1.5";

  const hasDataValue = !!data.value || !!inputTaskArgument;
  const hasDataDefault = !!data.default;

  const inputValue = hasDataValue
    ? (inputTaskArgument ?? data.value)
    : hasDataDefault
      ? data.default
      : isInSubgraph
        ? "→subgraph arguments"
        : null;

  const outputValue = outputConnectedValue ?? data.value ?? null;

  const value = isInput ? inputValue : outputValue;

  // The rest of our code doesn't support IO Handles having ids (yet).
  // For now, only assign an id to the Handle if this is a ghost node.
  const handleId = id === GHOST_NODE_ID ? getGhostHandleId() : undefined;

  return (
    <Card className={cn("border-2 max-w-[300px] p-0", borderColor)}>
      <CardHeader className="px-2 py-2.5">
        <CardTitle className="wrap-break-word text-sm">{data.label}</CardTitle>
      </CardHeader>
      <CardContent className="p-2 max-w-[250px]">
        <BlockStack gap="2">
          {/* type */}
          <Paragraph size="xs" font="mono" className="truncate text-slate-700">
            <span className="font-bold">Type:</span>{" "}
            {outputConnectedType ?? data.type ?? "Any"}
          </Paragraph>

          {!!outputConnectedTaskId && (
            <Paragraph size="xs" weight="bold" className="text-slate-700">
              {outputConnectedTaskId}
            </Paragraph>
          )}

          {/* value */}
          <InlineStack gap="1" className="p-2 bg-white rounded-lg w-full">
            <Paragraph
              size="xs"
              font="mono"
              weight="bold"
              className="text-slate-700"
            >
              Value:
            </Paragraph>
            <Paragraph
              size="xs"
              font="mono"
              tone={!value ? "critical" : "subdued"}
              className="truncate"
            >
              {value ?? "No value"}
            </Paragraph>
          </InlineStack>
        </BlockStack>
        <Handle
          id={handleId}
          type={handleType}
          position={handlePosition}
          className={cn(handleDefaultClassName, handleClassName)}
        />
      </CardContent>
    </Card>
  );
};

export default memo(IONode);
