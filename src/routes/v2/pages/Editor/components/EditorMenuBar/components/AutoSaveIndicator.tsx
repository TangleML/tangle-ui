import { observer } from "mobx-react-lite";
import { useEffect, useId, useRef, useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { tracking } from "@/utils/tracking";

export const AutoSaveIndicator = observer(function AutoSaveIndicator() {
  const { autoSave, pipelineFile } = useEditorSession();
  const storage = usePipelineStorage();
  const statusId = useId();
  const file = pipelineFile.activePipelineFile;
  const isSaving = autoSave.isSaving || Boolean(file?.isSaving);
  const lastSavedAt = autoSave.lastSavedAt;
  const hasUnsavedChanges = autoSave.hasUnsavedChanges;
  const saveError = autoSave.error ?? file?.saveError;
  const storageKind = file?.storageKind;
  const canEdit = file?.canEdit;
  const previousSave = useRef({ file, lastSavedAt });
  const [confirmedSave, setConfirmedSave] = useState<Date | null>(null);

  useEffect(() => {
    if (previousSave.current.file !== file) {
      previousSave.current = { file, lastSavedAt };
      setConfirmedSave(null);
      return;
    }
    if (isSaving) {
      setConfirmedSave(null);
      return;
    }
    const isNewSave = previousSave.current.lastSavedAt !== lastSavedAt;
    previousSave.current.lastSavedAt = lastSavedAt;
    if (
      hasUnsavedChanges ||
      saveError ||
      storageKind !== "remote" ||
      !canEdit
    ) {
      setConfirmedSave(null);
      return;
    }
    if (isNewSave && lastSavedAt) setConfirmedSave(lastSavedAt);
  }, [
    file,
    lastSavedAt,
    isSaving,
    hasUnsavedChanges,
    saveError,
    storageKind,
    canEdit,
  ]);

  useEffect(() => {
    if (!confirmedSave) return;
    const timeout = setTimeout(() => setConfirmedSave(null), 750);
    return () => clearTimeout(timeout);
  }, [confirmedSave]);

  if (!file) return null;
  const error =
    autoSave.error ??
    (autoSave.hasUnsavedChanges || isSaving ? undefined : file.saveError);
  const canPublish = storage.canMigrate(file);
  const isRemote = file.storageKind !== "local";
  const showProgress =
    !error && file.canEdit && (isSaving || autoSave.hasUnsavedChanges);
  const showSuccess =
    confirmedSave !== null &&
    file.storageKind === "remote" &&
    file.canEdit &&
    !isSaving &&
    !hasUnsavedChanges &&
    !saveError;
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
            : showSuccess
              ? "Saved"
              : null;
  const tooltip =
    error ??
    (file.canEdit
      ? (status ??
        (canPublish
          ? "Save to server"
          : autoSave.lastSavedAt
            ? `Last saved at ${autoSave.lastSavedAt.toLocaleTimeString()}`
            : isRemote
              ? "Autosaves to server"
              : "Autosaves locally"))
      : "View only. Clone to my pipelines to edit.");

  return (
    <InlineStack gap="1" wrap="nowrap" blockAlign="center" aria-live="polite">
      {status && (
        <Text
          id={statusId}
          size="xs"
          className={cn(
            "max-w-36",
            error ? "text-amber-300" : "text-stone-300",
            !error && file.storageKind !== "pending" && "sr-only",
          )}
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
          className="px-3"
          disabled={isSaving || !file.canEdit}
          onClick={() => void autoSave.save()}
          aria-busy={isSaving}
          aria-describedby={status ? statusId : undefined}
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
          <span className="relative block size-4" aria-hidden="true">
            <Icon
              key={confirmedSave?.getTime() ?? "idle"}
              name={isRemote ? "Cloud" : "HardDrive"}
              className={cn(
                "transition-colors motion-reduce:transition-none",
                isRemote && showProgress && "text-yellow-200",
                showSuccess &&
                  "text-emerald-300 animate-pipeline-save-success motion-reduce:animate-none",
              )}
            />
            {showProgress && (
              <span className="absolute -right-1 -bottom-0.5 rounded-full bg-stone-900 p-px">
                <Spinner
                  size={10}
                  className="size-2.5 stroke-[2.5] text-indigo-300 [animation-duration:1.5s] motion-reduce:animate-none"
                />
              </span>
            )}
          </span>
        </TooltipButton>
      )}
    </InlineStack>
  );
});
