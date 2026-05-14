import { observer } from "mobx-react-lite";
import type { MouseEvent, PointerEvent } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { tracking } from "@/utils/tracking";

const stopPointer = (event: PointerEvent<HTMLButtonElement>) => {
  event.stopPropagation();
};

export const HistoryWindowMiniContent = observer(
  function HistoryWindowMiniContent() {
    const { undo } = useEditorSession();
    const { canUndo, canRedo } = undo;

    const handleUndo = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      undo.undo();
    };

    const handleRedo = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      undo.redo();
    };

    return (
      <InlineStack gap="1">
        <TooltipButton
          tooltip="Undo"
          tooltipSide="right"
          variant="outline"
          size="icon"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo}
          onClick={handleUndo}
          onPointerDown={stopPointer}
          {...tracking("v2.pipeline_editor.history.undo")}
        >
          <Icon name="Undo2" size="sm" />
        </TooltipButton>
        <TooltipButton
          tooltip="Redo"
          tooltipSide="right"
          variant="outline"
          size="icon"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
          onClick={handleRedo}
          onPointerDown={stopPointer}
          {...tracking("v2.pipeline_editor.history.redo")}
        >
          <Icon name="Redo2" size="sm" />
        </TooltipButton>
      </InlineStack>
    );
  },
);
