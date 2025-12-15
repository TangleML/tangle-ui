import { type ReactNode } from "react";
import { FaPython } from "react-icons/fa";

import useToastNotification from "@/hooks/useToastNotification";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import {
  downloadStringAsFile,
  downloadYamlFromComponentText,
} from "@/utils/URL";

import {
  ActionBlock,
  type ActionOrReactNode,
} from "../ContextPanel/Blocks/ActionBlock";

interface TaskActionsProps {
  displayName: string;
  componentRef: HydratedComponentReference;
  actions?: ReactNode[];
  onDelete?: () => void;
  readOnly?: boolean;
  className?: string;
}

const TaskActions = ({
  displayName,
  componentRef,
  actions = [],
  onDelete,
  readOnly = false,
  className,
}: TaskActionsProps) => {
  const notify = useToastNotification();

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

  const orderedActions: ActionOrReactNode[] = [
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
    ...actions,
    {
      label: "Delete Component",
      icon: "Trash",
      destructive: true,
      hidden: !onDelete || readOnly,
      onClick: handleDelete,
    },
  ];

  return <ActionBlock actions={orderedActions} className={className} />;
};

export default TaskActions;
