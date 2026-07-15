import { type ReactNode } from "react";

import type { TaskSpecOutput } from "@/api/types.gen";
import { Attribute } from "@/components/shared/ContextPanel/Blocks/Attribute";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { typeSpecToString } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { type InputSpec, type OutputSpec } from "@/utils/componentSpec";
import { getArgumentValue } from "@/utils/nodes/taskArguments";

import { InputValueEditor } from "../../Editor/IOEditor/InputValueEditor";
import { OutputNameEditor } from "../../Editor/IOEditor/OutputNameEditor";
import { getOutputConnectedDetails } from "../../Editor/utils/getOutputConnectedDetails";

const PipelineIO = ({
  taskArguments,
  section,
}: {
  taskArguments?: TaskSpecOutput["arguments"] | null;
  /**
   * When set, renders only one side (without the wrapping ContentBlock) so the
   * caller can supply its own section header (e.g. a collapsible section).
   * When omitted, renders both Inputs/Arguments and Outputs blocks.
   */
  section?: "inputs" | "outputs";
}) => {
  const { setContent } = useContextPanel();
  const { componentSpec, graphSpec } = useComponentSpec();
  const { track } = useAnalytics();

  const readOnly = !!taskArguments;

  const handleInputEdit = (input: InputSpec) => {
    track("pipeline_editor.configuration_panel.io_edit.click", {
      io_type: "input",
    });
    setContent(<InputValueEditor key={input.name} input={input} />);
  };

  const handleOutputEdit = (output: OutputSpec) => {
    track("pipeline_editor.configuration_panel.io_edit.click", {
      io_type: "output",
    });
    const outputConnectedDetails = getOutputConnectedDetails(
      graphSpec,
      output.name,
    );
    setContent(
      <OutputNameEditor
        connectedDetails={outputConnectedDetails}
        key={output.name}
        output={output}
      />,
    );
  };

  const inputActions: IORowAction[] = [
    {
      label: "Edit",
      icon: <Icon name="Pencil" size="sm" />,
      hidden: readOnly,
      onClick: handleInputEdit,
    },
  ];

  const outputActions: IORowAction[] = [
    {
      label: "Edit",
      icon: <Icon name="Pencil" size="sm" />,
      hidden: readOnly,
      onClick: handleOutputEdit,
    },
  ];

  const hasInputs = !!componentSpec.inputs && componentSpec.inputs.length > 0;
  const hasOutputs =
    !!componentSpec.outputs && componentSpec.outputs.length > 0;

  const inputsContent = hasInputs ? (
    <BlockStack>
      {componentSpec.inputs?.map((input) => (
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
          actions={inputActions}
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
      {componentSpec.outputs?.map((output) => {
        const connectedOutput = getOutputConnectedDetails(
          graphSpec,
          output.name,
        );

        return (
          <IORow
            key={output.name}
            value={connectedOutput.outputName ?? "No value"}
            type={typeSpecToString(connectedOutput.outputType)}
            spec={output}
            actions={outputActions}
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

type IORowAction = {
  label: string;
  icon?: ReactNode;
  hidden?: boolean;
  onClick: (spec: InputSpec | OutputSpec) => void;
};

interface IORowProps {
  spec: InputSpec | OutputSpec;
  value: string;
  type: string;
  actions?: IORowAction[];
}

function IORow({ spec, value, type, actions }: IORowProps) {
  return (
    <InlineStack
      gap="1"
      align="space-between"
      blockAlign="center"
      className="even:bg-white odd:bg-secondary px-2 py-0 rounded-xs w-full"
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
        {actions?.map(
          (action) =>
            !action.hidden && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => action.onClick(spec)}
                className="text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
                key={action.label}
              >
                {action.icon ?? action.label}
              </Button>
            ),
        )}
      </InlineStack>
    </InlineStack>
  );
}
