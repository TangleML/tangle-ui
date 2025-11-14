import { useCallback, useEffect, useState } from "react";

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
import { NameField, TypeField } from "../InputValueEditor/FormFields";
import { checkNameCollision } from "../InputValueEditor/FormFields/utils";

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
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasChanges = useCallback(() => {
    return outputName.trim() !== output.name;
  }, [outputName, output.name]);

  const handleOutputNameChange = useCallback(
    (oldName: string, newName: string) => {
      if (!currentSubgraphSpec.outputs) return null;

      const updatedComponentSpec = updateOutputNameOnComponentSpec(
        currentSubgraphSpec,
        oldName,
        newName,
      );

      transferSelection(oldName, newName);

      return updatedComponentSpec;
    },
    [currentSubgraphSpec, transferSelection],
  );

  const saveChanges = useCallback(() => {
    if (!hasChanges() || validationError) return;

    if (outputName.trim() === "") {
      setValidationError("Output name cannot be empty");
      return;
    }

    const updatedSubgraphSpec = handleOutputNameChange(
      output.name,
      outputName.trim(),
    );

    if (updatedSubgraphSpec) {
      const updatedRootSpec = updateSubgraphSpec(
        componentSpec,
        currentSubgraphPath,
        updatedSubgraphSpec,
      );
      setComponentSpec(updatedRootSpec);
    }
  }, [
    hasChanges,
    validationError,
    handleOutputNameChange,
    output.name,
    outputName,
    setComponentSpec,
    componentSpec,
    currentSubgraphPath,
  ]);

  const handleBlur = useCallback(() => {
    saveChanges();
  }, [saveChanges]);

  const handleNameChange = useCallback(
    (value: string) => {
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
    },
    [componentSpec, output.name],
  );

  const deleteNode = useCallback(async () => {
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
  }, [
    currentSubgraphSpec,
    output.name,
    setComponentSpec,
    clearContent,
    triggerConfirmation,
    componentSpec,
    currentSubgraphPath,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      setOutputName(output.name);
    });
  }, [output.name]);

  return (
    <BlockStack gap="3" className="p-4 w-full">
      <BlockStack gap="3">
        <Heading level={1}>{output.name}</Heading>
        {!!output.description && (
          <Paragraph size="sm" tone="subdued">
            {output.description}
          </Paragraph>
        )}
      </BlockStack>
      <InlineStack gap="4" className="w-full">
        <div className="flex-1">
          <NameField
            inputName={outputName}
            onNameChange={handleNameChange}
            onBlur={handleBlur}
            disabled={disabled}
            error={validationError}
          />
        </div>
        <div className="w-36">
          <TypeField
            inputValue={connectedDetails.outputType ?? "Any"}
            onInputChange={() => {}}
            placeholder="Any"
            disabled
            inputName={output.name}
          />
        </div>
      </InlineStack>

      {!disabled && (
        <Button onClick={deleteNode} variant="destructive" size="icon">
          <Icon name="Trash2" />
        </Button>
      )}

      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
    </BlockStack>
  );
};
