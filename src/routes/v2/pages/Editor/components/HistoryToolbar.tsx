import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";

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
                onClick={onUndo}
                disabled={!canUndo}
              >
                <Icon name="Undo2" size="xs" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <Text size="xs">Undo (⌘Z)</Text>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onRedo}
                disabled={!canRedo}
              >
                <Icon name="Redo2" size="xs" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <Text size="xs">Redo (⌘⇧Z)</Text>
            </TooltipContent>
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
              onClick={onClear}
              title="Clear history"
            >
              <Icon name="Trash2" size="xs" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <Text size="xs">Clear history</Text>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
