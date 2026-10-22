import type { TaskSpecOutput } from "@/api/types.gen";
import { Attribute } from "@/components/shared/ContextPanel/Blocks/Attribute";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { typeSpecToString } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/utils";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import {
  type ComponentSpec,
  type InputSpec,
  isGraphImplementation,
  isTaskOutputArgument,
  type OutputSpec,
} from "@/utils/componentSpec";
import { getArgumentValue } from "@/utils/nodes/taskArguments";

const PipelineIO = ({
  componentSpec,
  taskArguments,
  section,
}: {
  componentSpec?: ComponentSpec;
  taskArguments?: TaskSpecOutput["arguments"] | null;
  // When set, renders only one side (without the wrapping ContentBlock) so the
  // caller can supply its own section header (e.g. a collapsible section).
  // When omitted, renders both Inputs/Arguments and Outputs blocks.
  section?: "inputs" | "outputs";
}) => {
  const implementation = componentSpec?.implementation;
  const graphSpec = isGraphImplementation(implementation)
    ? implementation.graph
    : undefined;
  const hasInputs = !!componentSpec?.inputs?.length;
  const hasOutputs = !!componentSpec?.outputs?.length;

  const inputsContent = hasInputs ? (
    <BlockStack>
      {componentSpec?.inputs?.map((input) => (
        <IORow
          key={input.name}
          value={
            getArgumentValue(taskArguments, input.name) ||
            input.value ||
            input.default ||
            "—"
          }
          type={typeSpecToString(input?.type)}
          spec={input}
        />
      ))}
    </BlockStack>
  ) : (
    <Paragraph tone="subdued" size="xs">
      No inputs
    </Paragraph>
  );

  const outputsContent = hasOutputs ? (
    <BlockStack>
      {componentSpec?.outputs?.map((output) => {
        const value = graphSpec?.outputValues?.[output.name];
        const source = isTaskOutputArgument(value)
          ? value.taskOutput
          : undefined;
        const sourceType = source
          ? graphSpec?.tasks[source.taskId]?.componentRef.spec?.outputs?.find(
              (port) => port.name === source.outputName,
            )?.type
          : undefined;

        return (
          <IORow
            key={output.name}
            value={source?.outputName ?? "No value"}
            type={typeSpecToString(sourceType)}
            spec={output}
          />
        );
      })}
    </BlockStack>
  ) : (
    <Paragraph tone="subdued" size="xs">
      No outputs
    </Paragraph>
  );

  if (section === "inputs") {
    return inputsContent;
  }

  if (section === "outputs") {
    return outputsContent;
  }

  return (
    <BlockStack gap="4">
      <ContentBlock title={taskArguments ? "Arguments" : "Inputs"}>
        {inputsContent}
      </ContentBlock>
      <ContentBlock title="Outputs">{outputsContent}</ContentBlock>
    </BlockStack>
  );
};

export default PipelineIO;

interface IORowProps {
  spec: InputSpec | OutputSpec;
  value: string;
  type: string;
}

function IORow({ spec, value, type }: IORowProps) {
  return (
    <InlineStack
      gap="1"
      align="space-between"
      blockAlign="center"
      className="even:bg-card odd:bg-muted px-2 py-0 rounded-xs w-full"
      wrap="nowrap"
    >
      <div className="flex-1 min-w-0">
        <Attribute label={spec.name} value={value} copyable />
      </div>

      <InlineStack
        className="min-w-16 shrink-0"
        align="end"
        blockAlign="center"
      >
        <Paragraph size="xs" tone="subdued">
          ({type})
        </Paragraph>
      </InlineStack>
    </InlineStack>
  );
}
