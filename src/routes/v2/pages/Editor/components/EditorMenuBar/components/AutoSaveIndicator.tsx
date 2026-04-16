import { observer } from "mobx-react-lite";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

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

  return (
    <TooltipButton
      tooltip={tooltipText}
      className="hover:bg-transparent"
      disabled={isSaving}
      data-testid="auto-save-button"
    >
      {isSaving ? (
        <Spinner size={16} />
      ) : (
        <Icon
          name="CloudCheck"
          className="text-stone-400 hover:text-white transition-colors"
        />
      )}
    </TooltipButton>
  );
});
