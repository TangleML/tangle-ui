/**
 * HistoryContent - displays undo/redo history with interactive controls.
 *
 * Shows a timeline of undo/redo entries from the mobx-keystone UndoManager.
 * Users can undo/redo and clear history.
 */

import type { UndoEvent } from "mobx-keystone";
import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { undoStore } from "@/routes/EditorV2/store/undoStore";

function getUndoEventName(event: UndoEvent): string {
  if (event.type === "group") return event.groupName ?? "Group action";
  return event.actionName ?? "Action";
}

interface HistoryEntryItemProps {
  actionName: string;
  index: number;
  isCurrent: boolean;
  isInFuture: boolean;
  onClick: () => void;
}

/**
 * Individual history entry item.
 */
function HistoryEntryItem({
  actionName,
  isCurrent,
  isInFuture,
  onClick,
}: HistoryEntryItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-1.5 px-2 py-1 rounded w-full text-left transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-inset",
        isCurrent && "bg-blue-50 border border-blue-200 hover:bg-blue-100",
        isInFuture && "opacity-50",
        !isCurrent && !isInFuture && "border border-transparent",
      )}
    >
      {/* Timeline indicator */}
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 mt-1",
          isCurrent
            ? "bg-blue-500"
            : isInFuture
              ? "bg-slate-300"
              : "bg-green-500",
        )}
      />

      {/* Content */}
      <Text
        size="xs"
        weight={isCurrent ? "semibold" : "regular"}
        className={cn(
          "min-w-0 flex-1 break-words",
          isCurrent
            ? "text-blue-700"
            : isInFuture
              ? "text-slate-400"
              : "text-slate-700",
        )}
      >
        {actionName}
        {isCurrent && (
          <Text as="span" size="xs" className="text-blue-500 ml-1">
            ●
          </Text>
        )}
      </Text>

      {/* Arrow indicator */}
      {!isCurrent && (
        <Icon
          name={isInFuture ? "Redo2" : "Undo2"}
          size="xs"
          className={cn(
            "shrink-0 mt-0.5",
            isInFuture ? "text-slate-400" : "text-green-600",
          )}
        />
      )}
    </button>
  );
}

/**
 * Initial state marker shown at the bottom of the history.
 */
function InitialStateMarker({
  isCurrent,
  onClick,
}: {
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCurrent}
      className={cn(
        "flex items-start gap-1.5 px-2 py-1 rounded w-full text-left transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-inset",
        isCurrent && "bg-green-50 border border-green-200 hover:bg-green-50",
        !isCurrent && "border border-transparent",
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 mt-1",
          isCurrent ? "bg-green-500" : "bg-slate-300",
        )}
      />
      <Text
        size="xs"
        weight={isCurrent ? "semibold" : "regular"}
        className={cn(
          "min-w-0 flex-1 break-words",
          isCurrent ? "text-green-700" : "text-slate-500",
        )}
      >
        Initial state
        {isCurrent && (
          <Text as="span" size="xs" className="text-green-500 ml-1">
            ●
          </Text>
        )}
      </Text>
      {!isCurrent && (
        <Icon
          name="RotateCcw"
          size="xs"
          className="shrink-0 mt-0.5 text-slate-400"
        />
      )}
    </button>
  );
}

export const HistoryContent = observer(function HistoryContent() {
  const { canUndo, canRedo, undoLevels, redoLevels } = undoStore;
  const undoManager = undoStore.undoManager;

  const totalCommands = undoLevels + redoLevels;

  const handleClear = () => {
    undoStore.clearHistory();
  };

  const handleUndo = () => {
    undoStore.undo();
  };

  const handleRedo = () => {
    undoStore.redo();
  };

  // Undo back to initial state
  const handleInitialClick = () => {
    while (undoStore.canUndo) {
      undoStore.undo();
    }
  };

  if (totalCommands === 0) {
    return (
      <BlockStack
        gap="2"
        className="p-3 h-full items-center justify-center"
        align="center"
      >
        <Icon name="History" size="md" className="text-slate-300" />
        <Text size="xs" tone="subdued" className="text-center">
          No history yet
        </Text>
      </BlockStack>
    );
  }

  const undoQueue = undoManager?.undoQueue ?? [];
  const redoQueue = undoManager?.redoQueue ?? [];

  // Redo entries: show from oldest (first to redo) at top to newest (closest to current) at bottom
  const redoEntries = [...redoQueue].reverse();
  // Undo entries: most recent at top (current), oldest at bottom
  const undoEntries = [...undoQueue].reverse();

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header with undo/redo buttons */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-200 justify-between w-full shrink-0">
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleUndo}
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
                  onClick={handleRedo}
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
                onClick={handleClear}
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

      {/* History entries */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 flex flex-col gap-1 w-full">
        {/* Future (redo queue) - shown at top, grayed out */}
        {redoEntries.length > 0 && (
          <>
            <Text size="xs" tone="subdued" className="px-2 py-0.5">
              Future
            </Text>
            <div className="flex flex-col gap-0.5 w-full">
              {redoEntries.map((entry, displayIndex) => (
                <HistoryEntryItem
                  key={`redo-${displayIndex}`}
                  actionName={getUndoEventName(entry)}
                  index={displayIndex}
                  isCurrent={false}
                  isInFuture={true}
                  onClick={() => {
                    // Redo forward to this entry
                    const stepsForward = displayIndex + 1;
                    for (let i = 0; i < stepsForward; i++) {
                      undoStore.redo();
                    }
                  }}
                />
              ))}
            </div>
            <div className="border-t border-dashed border-slate-300 my-1 mx-2" />
          </>
        )}

        {/* Current position indicator */}
        {undoLevels > 0 && (
          <Text size="xs" tone="subdued" className="px-2 py-0.5">
            Past
          </Text>
        )}

        {/* Past (undo queue) - shown below, most recent first */}
        <div className="flex flex-col gap-0.5 w-full">
          {undoEntries.map((entry, displayIndex) => {
            const isCurrent = displayIndex === 0;
            return (
              <HistoryEntryItem
                key={`undo-${displayIndex}`}
                actionName={getUndoEventName(entry)}
                index={displayIndex}
                isCurrent={isCurrent}
                isInFuture={false}
                onClick={() => {
                  if (!isCurrent) {
                    // Undo back to this position
                    for (let i = 0; i < displayIndex; i++) {
                      undoStore.undo();
                    }
                  }
                }}
              />
            );
          })}
        </div>

        {/* Initial state marker */}
        <InitialStateMarker
          isCurrent={undoLevels === 0}
          onClick={handleInitialClick}
        />
      </div>
    </div>
  );
});
