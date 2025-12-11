import { useState } from "react";
import { FaPython } from "react-icons/fa";

import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentSpec } from "@/utils/componentSpec";
import { downloadYamlFromComponentText } from "@/utils/URL";
import copyToYaml, { componentSpecToText } from "@/utils/yaml";

import { ComponentEditorDialog } from "../ComponentEditor/ComponentEditorDialog";
import { type Action, ActionBlock } from "../ContextPanel/Blocks/ActionBlock";
import { useBetaFlagValue } from "../Settings/useBetaFlags";

interface TaskActionsProps {
  displayName: string;
  componentSpec: ComponentSpec;
  customActions?: Action[];
  onDelete?: () => void;
  readOnly?: boolean;
  className?: string;
}

const TaskActions = ({
  displayName,
  componentSpec,
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
    componentSpec?.metadata?.annotations?.original_python_code;

  const stringToPythonCodeDownload = () => {
    if (!pythonOriginalCode) return;

    const blob = new Blob([pythonOriginalCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${componentSpec?.name || displayName}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadYaml = () => {
    downloadYamlFromComponentText(componentSpec, displayName);
  };

  const handleCopyYaml = () => {
    copyToYaml(
      componentSpec,
      (message) => notify(message, "success"),
      (message) => notify(message, "error"),
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

  const allActions: Action[] = [...customActions, ...sharedActions];

  return (
    <>
      <ActionBlock actions={allActions} className={className} />

      {isEditDialogOpen && (
        <ComponentEditorDialog
          text={componentSpecToText(componentSpec)}
          onClose={handleCloseEditDialog}
        />
      )}
    </>
  );
};

export default TaskActions;
