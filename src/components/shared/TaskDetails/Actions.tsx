import { useState } from "react";
import { FaPython } from "react-icons/fa";

import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import {
  downloadStringAsFile,
  downloadYamlFromComponentText,
} from "@/utils/URL";

import { ComponentEditorDialog } from "../ComponentEditor/ComponentEditorDialog";
import { type Action, ActionBlock } from "../ContextPanel/Blocks/ActionBlock";
import { useBetaFlagValue } from "../Settings/useBetaFlags";

interface TaskActionsProps {
  displayName: string;
  componentRef: HydratedComponentReference;
  customActions?: Action[];
  onDelete?: () => void;
  readOnly?: boolean;
  className?: string;
}

const TaskActions = ({
  displayName,
  componentRef,
  customActions = [],
  onDelete,
  readOnly = false,
  className,
}: TaskActionsProps) => {
  const hasEnabledInAppEditor = useBetaFlagValue("in-app-component-editor");
  const notify = useToastNotification();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleEditComponent = () => {
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
  };

  const pythonOriginalCode =
    componentRef.spec.metadata?.annotations?.original_python_code;

  const stringToPythonCodeDownload = () => {
    if (!pythonOriginalCode) return;

    downloadStringAsFile(
      pythonOriginalCode,
      `${componentRef.name || displayName}.py`,
      "text/x-python",
    );
  };

  const handleDownloadYaml = () => {
    downloadYamlFromComponentText(componentRef.text, displayName);
  };

  const handleCopyYaml = () => {
    const code = componentRef.text;

    navigator.clipboard.writeText(code).then(
      () => notify("YAML copied to clipboard", "success"),
      (err) => notify("Failed to copy YAML: " + err, "error"),
    );
  };

  const handleDelete = () => {
    try {
      onDelete?.();
    } catch (error) {
      console.error("Error deleting component:", error);
      notify(`Error deleting component`, "error");
    }
  };

  const sharedActions: Action[] = [
    {
      label: "Download YAML",
      icon: "Download",
      onClick: handleDownloadYaml,
    },
    {
      label: "Download Python Code",
      content: <FaPython />,
      hidden: !pythonOriginalCode,
      onClick: stringToPythonCodeDownload,
    },
    {
      label: "Copy YAML",
      icon: "Clipboard",
      onClick: handleCopyYaml,
    },
    {
      label: "Edit Component Definition",
      icon: "FilePenLine",
      hidden: !hasEnabledInAppEditor,
      onClick: handleEditComponent,
    },
    {
      label: "Delete Component",
      icon: "Trash",
      destructive: true,
      hidden: !onDelete || readOnly,
      onClick: handleDelete,
    },
  ];

  return (
    <>
      <BlockStack gap="4" className={className}>
        <ActionBlock title="Component Actions" actions={sharedActions} />
        {customActions.length > 0 && (
          <ActionBlock title="Node Actions" actions={customActions} />
        )}
      </BlockStack>

      {isEditDialogOpen && (
        <ComponentEditorDialog
          text={componentRef.text}
          onClose={handleCloseEditDialog}
        />
      )}
    </>
  );
};

export default TaskActions;
