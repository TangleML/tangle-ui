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

function getTooltipText(isSaving: boolean, lastSavedAt: Date | null): string {
  if (isSaving) return "Saving...";
  if (lastSavedAt) {
    return `Last saved at ${lastSavedAt.toLocaleTimeString()}`;
  }
  return "Auto-save enabled";
}

export const AutoSaveIndicator = observer(function AutoSaveIndicator() {
  const { autoSave } = useEditorSession();
  const { isSaving, lastSavedAt } = autoSave;
  const tooltipText = getTooltipText(isSaving, lastSavedAt);

  const handleClick = () => {
    void autoSave.save();
  };

  return (
    <TooltipButton
      tooltip={tooltipText}
      className="hover:bg-transparent"
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
          <Icon name="CloudCheck" />
        </IdleLayer>
      </div>
    </TooltipButton>
  );
});
