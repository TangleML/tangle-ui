import { type ReactNode } from "react";
import { FaPython } from "react-icons/fa";

import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentSpec } from "@/utils/componentSpec";
import {
  downloadStringAsFile,
  downloadYamlFromComponentText,
} from "@/utils/URL";
import { componentSpecToText } from "@/utils/yaml";

import {
  ActionBlock,
  type ActionOrReactNode,
} from "../ContextPanel/Blocks/ActionBlock";

interface TaskActionsProps {
  displayName: string;
  componentSpec: ComponentSpec;
  actions?: ReactNode[];
  onDelete?: () => void;
  readOnly?: boolean;
  className?: string;
}

const TaskActions = ({
  displayName,
  componentSpec,
  actions = [],
  onDelete,
  readOnly = false,
  className,
}: TaskActionsProps) => {
  const notify = useToastNotification();

  const pythonOriginalCode =
    componentSpec?.metadata?.annotations?.original_python_code;

  const stringToPythonCodeDownload = () => {
    if (!pythonOriginalCode) return;

    downloadStringAsFile(
      pythonOriginalCode,
      `${componentSpec?.name || displayName}.py`,
      "text/x-python",
    );
  };

  const handleDownloadYaml = () => {
    downloadYamlFromComponentText(componentSpec, displayName);
  };

  const handleCopyYaml = () => {
    const code = componentSpecToText(componentSpec);

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
