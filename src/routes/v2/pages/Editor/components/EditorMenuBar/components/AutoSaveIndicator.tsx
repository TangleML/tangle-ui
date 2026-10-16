import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { tracking } from "@/utils/tracking";

const LAYER_BASE_CLASS =
  "absolute inset-0 inline-flex will-change-[opacity] [transform:translateZ(0)]";

function SavingLayer({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        LAYER_BASE_CLASS,
        "opacity-0 transition-opacity duration-150 ease-out delay-[600ms]",
        "group-data-[saving=true]:opacity-100 group-data-[saving=true]:delay-0",
      )}
    >
      {children}
    </span>
  );
}

function IdleLayer({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        LAYER_BASE_CLASS,
        "opacity-100 hover:text-white",
        "[transition:opacity_150ms_ease-out_600ms,color_1000ms_ease-out_750ms]",
        "group-data-[saving=true]:text-green-500 group-data-[saving=true]:opacity-0",
        "group-data-[saving=true]:[transition:opacity_150ms_ease-out,color_0ms]",
      )}
    >
      {children}
    </span>
  );
}

function getTooltipText(
  isSaving: boolean,
  lastSavedAt: Date | null,
  error: string | null,
): string {
  if (isSaving) return "Saving...";
  if (error) return `Save failed: ${error}. Click to retry.`;
  if (lastSavedAt) {
    return `Last saved at ${lastSavedAt.toLocaleTimeString()}`;
  }
  return "Auto-save enabled";
}

export const AutoSaveIndicator = observer(function AutoSaveIndicator() {
  const { autoSave, pipelineFile } = useEditorSession();
  const { isSaving, lastSavedAt, error } = autoSave;
  const isDraft = pipelineFile.activePipelineFile?.isDraft;
  const tooltipText =
    isDraft && !isSaving && !error
      ? "Draft — saved remotely after your first edit"
      : getTooltipText(isSaving, lastSavedAt, error);

  const handleClick = () => {
    void autoSave.save().catch(() => {});
  };

  return (
    <TooltipButton
      tooltip={tooltipText}
      aria-label={tooltipText}
      variant="header"
      disabled={isSaving}
      onClick={handleClick}
      data-testid="auto-save-button"
      {...tracking("v2.pipeline_editor.auto_save_indicator")}
    >
      <div
        data-saving={isSaving ? "true" : "false"}
        className="group relative isolate size-4"
      >
        <SavingLayer>
          <Spinner size={16} />
        </SavingLayer>
        <IdleLayer>
          <Icon
            name={error ? "CloudAlert" : isDraft ? "Cloud" : "CloudCheck"}
            className={error ? "text-red-400" : undefined}
          />
        </IdleLayer>
      </div>
      {error && (
        <span role="status" className="sr-only">
          Save failed: {error}
        </span>
      )}
    </TooltipButton>
  );
});
