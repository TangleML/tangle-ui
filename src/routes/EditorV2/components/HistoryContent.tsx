/**
 * HistoryContent - displays command history with interactive undo/redo.
 *
 * Shows a timeline of commands performed on the spec.
 * Users can click on any entry to revert to that state.
 */

import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import {
  canRedo,
  canUndo,
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
        "flex items-start gap-2 px-3 py-2 rounded-md w-full text-left transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset",
        isCurrent && "bg-blue-50 border border-blue-200 hover:bg-blue-100",
        isInFuture && "opacity-50",
        !isCurrent && !isInFuture && "border border-transparent",
      )}
    >
      {/* Timeline indicator */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isCurrent
              ? "bg-blue-500"
              : isInFuture
                ? "bg-slate-300"
                : "bg-green-500",
          )}
        />
      </div>

      {/* Content */}
      <BlockStack gap="0" className="min-w-0 flex-1">
        <Text
          size="sm"
          weight={isCurrent ? "semibold" : "regular"}
          className={cn(
            "break-words",
            isCurrent
              ? "text-blue-700"
              : isInFuture
                ? "text-slate-400"
                : "text-slate-700",
          )}
        >
          {command.description}
          {isCurrent && (
            <Text as="span" size="xs" className="text-blue-500 ml-2">
              (Current)
            </Text>
          )}
        </Text>
        {!isCurrent && !isInFuture && (
          <Text size="xs" tone="subdued">
            Click to revert
          </Text>
        )}
        {isInFuture && (
          <Text size="xs" tone="subdued">
            Click to redo
          </Text>
        )}
      </BlockStack>

      {/* Arrow indicator */}
      {!isCurrent && (
        <Icon
          name={isInFuture ? "Redo2" : "Undo2"}
          size="xs"
          className={cn(
            "shrink-0 mt-1",
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
        "flex items-start gap-2 px-3 py-2 rounded-md w-full text-left transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset",
        isCurrent && "bg-green-50 border border-green-200 hover:bg-green-50",
        !isCurrent && "border border-transparent",
      )}
    >
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isCurrent ? "bg-green-500" : "bg-slate-300",
          )}
        />
      </div>
      <BlockStack gap="0" className="min-w-0 flex-1">
        <Text
          size="sm"
          weight={isCurrent ? "semibold" : "regular"}
          className={cn(isCurrent ? "text-green-700" : "text-slate-500")}
        >
          Initial state
          {isCurrent && (
            <Text as="span" size="xs" className="text-green-500 ml-2">
              (Current)
            </Text>
          )}
        </Text>
        {!isCurrent && (
          <Text size="xs" tone="subdued">
            Click to revert all
          </Text>
        )}
      </BlockStack>
      {!isCurrent && (
        <Icon name="RotateCcw" size="xs" className="shrink-0 mt-1 text-slate-400" />
      )}
    </button>
  );
}

export function HistoryContent() {
  const snap = useSnapshot(commandManagerState);

  const undoStackLength = snap.undoStack.length;
  const redoStackLength = snap.redoStack.length;
  const totalCommands = undoStackLength + redoStackLength;

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
    // redoIndex is position in redo stack (0 = oldest redo, redoStackLength-1 = most recent redo)
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
        gap="4"
        className="p-4 h-full items-center justify-center"
        align="center"
      >
        <Icon name="History" size="lg" className="text-slate-300" />
        <Text size="sm" tone="subdued" className="text-center">
          No history yet.
          <br />
          Changes will appear here.
        </Text>
      </BlockStack>
    );
  }

  // Build the unified timeline (redo stack reversed + undo stack reversed)
  // Display order: future (redo) at top, past (undo) at bottom, newest first within each
  const redoEntries = [...snap.redoStack].reverse();
  const undoEntries = [...snap.undoStack].reverse();

  return (
    <BlockStack gap="2" className="h-full">
      {/* Header with undo/redo buttons */}
      <InlineStack
        gap="2"
        blockAlign="center"
        className="px-3 py-2 border-b border-slate-200 justify-between"
      >
        <InlineStack gap="1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleUndo}
                  disabled={!canUndo()}
                >
                  <Icon name="Undo2" size="sm" />
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
                  className="h-7 w-7 p-0"
                  onClick={handleRedo}
                  disabled={!canRedo()}
                >
                  <Icon name="Redo2" size="sm" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <Text size="xs">Redo (⌘⇧Z)</Text>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </InlineStack>

        <Text size="xs" tone="subdued">
          {undoStackLength} action{undoStackLength !== 1 ? "s" : ""}
          {redoStackLength > 0 && ` • ${redoStackLength} undone`}
        </Text>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-slate-500 hover:text-red-500"
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
      </InlineStack>

      {/* History entries */}
      <BlockStack gap="1" className="flex-1 overflow-y-auto px-2 pb-2">
        {/* Future (redo stack) - shown at top, grayed out */}
        {redoEntries.length > 0 && (
          <>
            <Text size="xs" tone="subdued" className="px-3 pt-2 pb-1">
              Future (undone)
            </Text>
            {redoEntries.map((command, displayIndex) => {
              // displayIndex is 0 for most future, redoEntries.length-1 for closest to current
              // Original redoStack index is (redoStackLength - 1 - displayIndex)
              const originalIndex = redoStackLength - 1 - displayIndex;
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
            <div className="border-t border-dashed border-slate-300 my-2 mx-3" />
          </>
        )}

        {/* Current position indicator */}
        {undoStackLength > 0 && (
          <Text size="xs" tone="subdued" className="px-3 pt-2 pb-1">
            Past
          </Text>
        )}

        {/* Past (undo stack) - shown below, most recent first */}
        {undoEntries.map((command, displayIndex) => {
          // displayIndex is 0 for most recent, undoEntries.length-1 for oldest
          // Original undoStack index is (undoStackLength - 1 - displayIndex)
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

        {/* Initial state marker */}
        <InitialStateMarker
          isCurrent={undoStackLength === 0}
          onClick={handleInitialClick}
        />
      </BlockStack>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-slate-200">
        <Text size="xs" tone="subdued" className="text-center">
          Click any entry to revert
        </Text>
      </div>
    </BlockStack>
  );
}
