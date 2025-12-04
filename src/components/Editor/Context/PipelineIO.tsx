import { type ReactNode } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "@/components/shared/ContextPanel/Blocks/ListBlock";
import { typeSpecToString } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { type InputSpec, type OutputSpec } from "@/utils/componentSpec";

import { InputValueEditor } from "../IOEditor/InputValueEditor";
import { OutputNameEditor } from "../IOEditor/OutputNameEditor";
import { getOutputConnectedDetails } from "../utils/getOutputConnectedDetails";

const PipelineIO = () => {
  const { setContent } = useContextPanel();
  const { componentSpec, graphSpec } = useComponentSpec();

  const notify = useToastNotification();

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

  const handleInputCopy = (input: InputSpec) => {
    const value = input.value ?? input.default;

    if (!value) {
      notify("Copy failed: Input has no value", "error");
      return;
    }

    void navigator.clipboard.writeText(value);
    notify("Input value copied to clipboard", "success");
  };

  return (
    <BlockStack gap="4">
      <ContentBlock title="Inputs">
        {componentSpec.inputs && componentSpec.inputs.length > 0 ? (
          <BlockStack>
            {componentSpec.inputs.map((input) => (
              // todo: rework actionblock and linkblock to be more generic
              // todo: split into smaller PRs - e.g. add generic blocks, then refactor task details to use them, then refactor pipeline details to use them, then refactor executiond etails etc
              <IORow
                key={input.name}
                name={input.name}
                value={input.value || input.default || "No value"}
                type={typeSpecToString(input?.type)}
                actions={[
                  {
                    label: "Copy",
                    icon: <Icon name="Copy" size="sm" />,
                    onClick: () => handleInputCopy(input),
                  },
                  {
                    label: "Edit",
                    onClick: () => handleInputEdit(input),
                  },
                ]}
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
                  name={output.name}
                  value={connectedOutput.outputName ?? "No value"}
                  type={typeSpecToString(connectedOutput.outputType)}
                  actions={[
                    {
                      label: "Edit",
                      onClick: () => handleOutputEdit(output),
                    },
                  ]}
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

interface IORowProps {
  name: string;
  value: string;
  type: string;
  actions?: { label: string; icon?: ReactNode; onClick: () => void }[];
}

function IORow({ name, value, type, actions }: IORowProps) {
  return (
    <InlineStack
      gap="1"
      align="space-between"
      blockAlign="center"
      className="even:bg-white odd:bg-gray-100 px-2 py-0 rounded-xs w-full"
    >
      <ListBlock
        items={[{ name, value }]}
        marker="none"
        className="w-2/5 max-w-[200px]"
      />
      <ListBlock
        items={[
          {
            name: "Type",
            value: type,
          },
        ]}
        marker="none"
        className="w-fit max-w-[200px]"
      />

      <InlineStack className="min-w-24" align="end" blockAlign="center">
        {actions?.map((action) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
            key={action.label}
          >
            {action.icon ?? action.label}
          </Button>
        ))}
      </InlineStack>
    </InlineStack>
  );
}
