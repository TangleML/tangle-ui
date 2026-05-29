import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";

export const CanvasUndoRedo = observer(function CanvasUndoRedo() {
  const { track } = useAnalytics();
  const { undo } = useEditorSession();

  const handleUndo = () => {
    track("v2.pipeline_canvas.controls.undo.click");
    undo.undo();
  };

  const handleRedo = () => {
    track("v2.pipeline_canvas.controls.redo.click");
    undo.redo();
  };

  return (
    <div
      className="absolute right-16 bottom-4 z-10 flex gap-1"
      data-tour="canvas-undo-redo"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="p-0"
              onClick={handleUndo}
              disabled={!undo.canUndo}
              aria-label="Undo"
            >
              <Icon name="Undo2" size="sm" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-1">
            Undo
            <ShortcutBadge id="undo" className="text-primary-foreground z-10" />
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="p-0"
              onClick={handleRedo}
              disabled={!undo.canRedo}
              aria-label="Redo"
            >
              <Icon name="Redo2" size="sm" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-1">
            Redo
            <ShortcutBadge id="redo" className="text-primary-foreground z-10" />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
});
