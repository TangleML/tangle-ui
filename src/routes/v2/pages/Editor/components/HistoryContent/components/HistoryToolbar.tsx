import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

interface HistoryToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  undoLevels: number;
  totalCommands: number;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export function HistoryToolbar({
  canUndo,
  canRedo,
  undoLevels,
  totalCommands,
  onUndo,
  onRedo,
  onClear,
}: HistoryToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-200 justify-between w-full shrink-0">
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                {...tracking("v2.pipeline_editor.history.undo")}
                onClick={onUndo}
                disabled={!canUndo}
              >
                <Icon name="Undo2" size="xs" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Undo (⌘Z)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                {...tracking("v2.pipeline_editor.history.redo")}
                onClick={onRedo}
                disabled={!canRedo}
              >
                <Icon name="Redo2" size="xs" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Text size="xs" tone="subdued">
        {`${undoLevels}/${totalCommands}`}
      </Text>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-slate-500 hover:text-red-500"
              {...tracking("v2.pipeline_editor.history.clear")}
              onClick={onClear}
            >
              <Icon name="Trash2" size="xs" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Clear history</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
