import { observer } from "mobx-react-lite";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { tracking } from "@/utils/tracking";

export const AutoSaveIndicator = observer(function AutoSaveIndicator() {
  const { autoSave, pipelineFile } = useEditorSession();
  const storage = usePipelineStorage();
  const file = pipelineFile.activePipelineFile;
  if (!file) return null;

  const isSaving = autoSave.isSaving || file.isSaving;
  const error =
    autoSave.error ??
    (autoSave.hasUnsavedChanges || isSaving ? undefined : file.saveError);
  const canPublish = storage.canMigrate(file);
  const isRemote = file.storageKind !== "local";
  const status =
    file.storageKind === "pending"
      ? "Pending upload"
      : error
        ? isRemote
          ? "Not saved to server"
          : "Not saved"
        : isSaving
          ? "Saving..."
          : autoSave.hasUnsavedChanges
            ? "Unsaved changes"
            : null;
  const tooltip =
    error ??
    (file.canEdit
      ? canPublish
        ? "Save to server"
        : autoSave.lastSavedAt
          ? `Last saved at ${autoSave.lastSavedAt.toLocaleTimeString()}`
          : isRemote
            ? "Autosaves to server"
            : "Autosaves locally"
      : "View only. Clone to my pipelines to edit.");

  return (
    <InlineStack gap="1" wrap="nowrap" blockAlign="center" aria-live="polite">
      {status && (
        <Text
          size="xs"
          className={
            error ? "text-amber-300 max-w-36" : "text-stone-300 max-w-36"
          }
        >
          {status}
        </Text>
      )}
      {error && file.canEdit ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-amber-300 hover:text-white"
          disabled={isSaving}
          onClick={() => void autoSave.save()}
          title={error}
        >
          <Icon name="RotateCw" size="sm" />
          Retry
        </Button>
      ) : (
        <TooltipButton
          tooltip={tooltip}
          variant="header"
          disabled={isSaving || !file.canEdit}
          onClick={() => void autoSave.save()}
          aria-label={
            !file.canEdit
              ? "View-only pipeline"
              : canPublish
                ? "Save to server"
                : "Save pipeline"
          }
          data-testid="auto-save-button"
          {...tracking("v2.pipeline_editor.auto_save_indicator")}
        >
          {isSaving ? (
            <Spinner size={16} />
          ) : (
            <Icon name={isRemote ? "Cloud" : "HardDrive"} />
          )}
        </TooltipButton>
      )}
    </InlineStack>
  );
});
