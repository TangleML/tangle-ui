import { useEffect, useState } from "react";

import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { removeGraphOutput } from "@/components/shared/ReactFlow/FlowCanvas/utils/removeNode";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import { useNodeSelectionTransfer } from "@/hooks/useNodeSelectionTransfer";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { type OutputSpec } from "@/utils/componentSpec";
import { outputNameToNodeId } from "@/utils/nodes/nodeIdUtils";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";

import { type OutputConnectedDetails } from "../../utils/getOutputConnectedDetails";
import { updateOutputNameOnComponentSpec } from "../../utils/updateOutputNameOnComponentSpec";
import {
  DescriptionField,
  NameField,
  TypeField,
} from "../InputValueEditor/FormFields";
import { checkNameCollision } from "../InputValueEditor/FormFields/utils";
import { IOZIndexEditor } from "../IOZIndexEditor";

interface OutputNameEditorProps {
  output: OutputSpec;
  disabled?: boolean;
  connectedDetails: OutputConnectedDetails;
}

export const OutputNameEditor = ({
  output,
  disabled,
  connectedDetails,
}: OutputNameEditorProps) => {
  const { transferSelection } = useNodeSelectionTransfer(outputNameToNodeId);
  const {
    setComponentSpec,
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
  } = useComponentSpec();
  const { clearContent } = useContextPanel();
  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  const [outputName, setOutputName] = useState(output.name);
  const [outputDescription, setOutputDescription] = useState(
    output.description ?? "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasChanges = () => {
    return (
      outputName.trim() !== output.name ||
      outputDescription !== (output.description ?? "")
    );
  };

  const handleOutputChange = (
    oldName: string,
    newName: string,
    description: string,
  ) => {
    if (!currentSubgraphSpec.outputs) return null;

    const updatedOutput = currentSubgraphSpec.outputs.map((componentOutput) => {
      if (componentOutput.name === oldName) {
        return {
          ...componentOutput,
          name: newName,
          description,
        };
      }
      return componentOutput;
    });

    const updatedComponentSpecValues = {
      ...currentSubgraphSpec,
      outputs: updatedOutput,
    };

    const updatedComponentSpec = updateOutputNameOnComponentSpec(
      updatedComponentSpecValues,
      oldName,
      newName,
    );

    transferSelection(oldName, newName);

    return updatedComponentSpec;
  };

  const handleDescriptionChange = (value: string) => {
    setOutputDescription(value);
  };

  const saveChanges = () => {
    if (!hasChanges() || validationError) return;

    if (outputName.trim() === "") {
      setValidationError("Output name cannot be empty");
      return;
    }

    const updatedSubgraphSpec = handleOutputChange(
      output.name,
      outputName.trim(),
      outputDescription,
    );

    if (updatedSubgraphSpec) {
      const updatedRootSpec = updateSubgraphSpec(
        componentSpec,
        currentSubgraphPath,
        updatedSubgraphSpec,
      );
      setComponentSpec(updatedRootSpec);
    }
  };

  const handleBlur = () => {
    saveChanges();
  };

  const handleNameChange = (value: string) => {
    setOutputName(value);

    if (
      checkNameCollision(
        value.trim(),
        output.name.trim(),
        componentSpec,
        "outputs",
      )
    ) {
      setValidationError("An output with this name already exists");
      return;
    }

    setValidationError(null);
  };

  const deleteNode = async () => {
    if (!currentSubgraphSpec.outputs) return;

    const confirmed = await triggerConfirmation({
      title: "Delete Output Node",
      description: `Are you sure you want to delete "${output.name}"?`,
      content: <Paragraph tone="subdued">This cannot be undone.</Paragraph>,
    });

    if (!confirmed) return;

    const updatedSubgraphSpec = removeGraphOutput(
      output.name,
      currentSubgraphSpec,
    );

    const updatedRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );

    setComponentSpec(updatedRootSpec);

    clearContent();
  };

  useEffect(() => {
    setOutputName(output.name);
    setOutputDescription(output.description ?? "");
  }, [output.name, output.description]);

  return (
    <BlockStack gap="3" className="p-4 w-full">
      <Heading level={1}>{output.name}</Heading>
      <div className="flex-1">
        <NameField
          inputName={outputName}
          onNameChange={handleNameChange}
          onBlur={handleBlur}
          disabled={disabled}
          error={validationError}
        />
      </div>
      <DescriptionField
        inputName={output.name}
        inputDescription={outputDescription}
        onChange={handleDescriptionChange}
        onBlur={handleBlur}
        disabled={disabled}
      />
      <div className="w-36">
        <TypeField
          inputValue={connectedDetails.outputType ?? "Any"}
          onInputChange={() => {}}
          placeholder="Any"
          disabled
          inputName={output.name}
        />
      </div>

      <InlineStack gap="4">
        {!disabled && (
          <Button onClick={deleteNode} variant="destructive" size="icon">
            <Icon name="Trash2" />
          </Button>
        )}

        <IOZIndexEditor ioSpec={output} ioType="output" />
      </InlineStack>

      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
    </BlockStack>
  );
};
