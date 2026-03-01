/**
 * HistoryContent - displays command history with interactive undo/redo.
 *
 * Shows a timeline of commands performed on the spec.
 * Users can click on any entry to revert to that state.
 */

import { useSnapshot } from "valtio";

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

import {
  clearCommandHistory,
  commandManagerState,
  redo,
  redoMultiple,
  undo,
  undoToIndex,
} from "../store/commandManager";
import type { Command } from "../store/commands";

interface HistoryEntryItemProps {
  command: Command;
  index: number;
  isCurrent: boolean;
  isInFuture: boolean;
  onClick: () => void;
}

/**
 * Individual history entry item (clickable to revert).
 */
function HistoryEntryItem({
  command,
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
        {command.description}
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

export function HistoryContent() {
  const snap = useSnapshot(commandManagerState);

  const undoStackLength = snap.undoStack.length;
  const redoStackLength = snap.redoStack.length;
  const totalCommands = undoStackLength + redoStackLength;

  // Compute from snapshot for reactivity (not from functions that read proxy directly)
  const canUndoValue = undoStackLength > 0;
  const canRedoValue = redoStackLength > 0;

  const handleClear = () => {
    clearCommandHistory();
  };

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => {
    redo();
  };

  // Handle clicking on an undo stack entry
  const handleUndoEntryClick = (index: number) => {
    // index is the position in the undo stack (0 = oldest, undoStackLength-1 = current)
    // We want to undo to get to index position
    undoToIndex(index);
  };

  // Handle clicking on a redo stack entry
  const handleRedoEntryClick = (redoIndex: number) => {
    // redoIndex is position in redo stack (0 = most recent action, redoStackLength-1 = closest to current)
    // We want to redo (redoStackLength - redoIndex) times to reach that state
    const stepsForward = redoStackLength - redoIndex;
    redoMultiple(stepsForward);
  };

  // Handle clicking initial state
  const handleInitialClick = () => {
    undoToIndex(-1);
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

  // Build the unified timeline
  // Display order: future (redo) at top, past (undo) at bottom
  // Redo: most recent action historically at top, oldest at bottom
  // Undo: most recent action at top (current), oldest at bottom
  const redoEntries = [...snap.redoStack];
  const undoEntries = [...snap.undoStack].reverse();

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
                  disabled={!canUndoValue}
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
                  disabled={!canRedoValue}
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
          {`${undoStackLength}/${totalCommands}`}
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
        {/* Future (redo stack) - shown at top, grayed out */}
        {redoEntries.length > 0 && (
          <>
            <Text size="xs" tone="subdued" className="px-2 py-0.5">
              Future
            </Text>
            <div className="flex flex-col gap-0.5 w-full">
              {redoEntries.map((command, displayIndex) => {
                const originalIndex = displayIndex;
                return (
                  <HistoryEntryItem
                    key={`redo-${originalIndex}`}
                    command={command as Command}
                    index={originalIndex}
                    isCurrent={false}
                    isInFuture={true}
                    onClick={() => handleRedoEntryClick(originalIndex)}
                  />
                );
              })}
            </div>
            <div className="border-t border-dashed border-slate-300 my-1 mx-2" />
          </>
        )}

        {/* Current position indicator */}
        {undoStackLength > 0 && (
          <Text size="xs" tone="subdued" className="px-2 py-0.5">
            Past
          </Text>
        )}

        {/* Past (undo stack) - shown below, most recent first */}
        <div className="flex flex-col gap-0.5 w-full">
          {undoEntries.map((command, displayIndex) => {
            const originalIndex = undoStackLength - 1 - displayIndex;
            const isCurrent = displayIndex === 0;
            return (
              <HistoryEntryItem
                key={`undo-${originalIndex}`}
                command={command as Command}
                index={originalIndex}
                isCurrent={isCurrent}
                isInFuture={false}
                onClick={() => {
                  if (!isCurrent) {
                    handleUndoEntryClick(originalIndex);
                  }
                }}
              />
            );
          })}
        </div>

        {/* Initial state marker */}
        <InitialStateMarker
          isCurrent={undoStackLength === 0}
          onClick={handleInitialClick}
        />
      </div>
    </div>
  );
}
