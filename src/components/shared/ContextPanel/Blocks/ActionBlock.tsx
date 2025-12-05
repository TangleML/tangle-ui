import { type ReactNode, useCallback, useState } from "react";
import { FaPython } from "react-icons/fa";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentSpec } from "@/utils/componentSpec";
import { downloadYamlFromComponentText } from "@/utils/URL";
import copyToYaml from "@/utils/yaml";

import TooltipButton from "../../Buttons/TooltipButton";

interface ActionBlockProps {
  displayName: string;
  componentSpec: ComponentSpec;
  actions?: ReactNode[];
  onDelete?: () => void;
  hasDeletionConfirmation?: boolean;
  readOnly?: boolean;
  className?: string;
}

const ActionBlock = ({
  displayName,
  componentSpec,
  actions = [],
  onDelete,
  hasDeletionConfirmation = true,
  readOnly = false,
  className,
}: ActionBlockProps) => {
  const notify = useToastNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDelete = useCallback(() => {
    if (confirmDelete || !hasDeletionConfirmation) {
      try {
        onDelete?.();
      } catch (error) {
        console.error("Error deleting component:", error);
        notify(`Error deleting component`, "error");
      }
    } else if (hasDeletionConfirmation) {
      setConfirmDelete(true);
    }
  }, [onDelete, confirmDelete, hasDeletionConfirmation, notify]);

  return (
    <InlineStack gap="2" className={className}>
      <TooltipButton
        variant="outline"
        tooltip="Download YAML"
        onClick={handleDownloadYaml}
      >
        <Icon name="Download" />
      </TooltipButton>

      {pythonOriginalCode && (
        <TooltipButton
          variant="outline"
          tooltip="Download Python Code"
          onClick={stringToPythonCodeDownload}
        >
          <FaPython />
        </TooltipButton>
      )}

      <TooltipButton
        variant="outline"
        tooltip="Copy YAML"
        onClick={handleCopyYaml}
      >
        <Icon name="Clipboard" />
      </TooltipButton>

      {actions}

      {onDelete && !readOnly && (
        <TooltipButton
          variant="destructive"
          tooltip={
            confirmDelete || !hasDeletionConfirmation
              ? "Confirm Delete. This action cannot be undone."
              : "Delete Component"
          }
          onClick={handleDelete}
        >
          <InlineStack gap="2" blockAlign="center">
            <Icon name="Trash" />
            {confirmDelete && hasDeletionConfirmation && (
              <Paragraph size="xs">Confirm Delete</Paragraph>
            )}
          </InlineStack>
        </TooltipButton>
      )}
    </InlineStack>
  );
};

export default ActionBlock;
