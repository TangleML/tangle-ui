import { type ReactNode } from "react";

import { Attribute } from "@/components/shared/ContextPanel/Blocks/Attribute";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { typeSpecToString } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { type InputSpec, type OutputSpec } from "@/utils/componentSpec";

import { InputValueEditor } from "../../Editor/IOEditor/InputValueEditor";
import { OutputNameEditor } from "../../Editor/IOEditor/OutputNameEditor";
import { getOutputConnectedDetails } from "../../Editor/utils/getOutputConnectedDetails";

const PipelineIO = ({ readOnly }: { readOnly?: boolean }) => {
  const { setContent } = useContextPanel();
  const { componentSpec, graphSpec } = useComponentSpec();

  const handleInputEdit = (input: InputSpec) => {
    setContent(<InputValueEditor key={input.name} input={input} />);
  };

  const handleOutputEdit = (output: OutputSpec) => {
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

  return (
    <BlockStack gap="4">
      <ContentBlock title="Inputs">
        {componentSpec.inputs && componentSpec.inputs.length > 0 ? (
          <BlockStack>
            {componentSpec.inputs.map((input) => (
              <IORow
                key={input.name}
                value={input.value || input.default || "—"}
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
        )}
      </ContentBlock>
      <ContentBlock title="Outputs">
        {componentSpec.outputs && componentSpec.outputs.length > 0 ? (
          <BlockStack>
            {componentSpec.outputs.map((output) => {
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
        )}
      </ContentBlock>
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
