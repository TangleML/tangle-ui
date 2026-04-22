import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

import { HistoryEntryItem } from "./components/HistoryEntryItem";
import { HistoryToolbar } from "./components/HistoryToolbar";
import { InitialStateMarker } from "./components/InitialStateMarker";
import { getUndoEventName } from "./historyContent.utils";

export const HistoryContent = observer(function HistoryContent() {
  const { undo } = useEditorSession();
  const { canUndo, canRedo, undoLevels, redoLevels } = undo;
  const undoManager = undo.undoManager;

  const totalCommands = undoLevels + redoLevels;

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

  const redoEntries = [...redoQueue];
  const undoEntries = [...undoQueue].reverse();

  const handleInitialClick = () => {
    while (undo.canUndo) {
      undo.undo();
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <HistoryToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        undoLevels={undoLevels}
        totalCommands={totalCommands}
        onUndo={() => undo.undo()}
        onRedo={() => undo.redo()}
        onClear={() => undo.clearHistory()}
      />

      <div className="flex-1 overflow-y-auto px-1.5 py-1 flex flex-col gap-1 w-full">
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
                    const stepsForward = redoEntries.length - displayIndex;
                    for (let i = 0; i < stepsForward; i++) {
                      undo.redo();
                    }
                  }}
                />
              ))}
            </div>
            <div className="border-t border-dashed border-slate-300 my-1 mx-2" />
          </>
        )}

        {undoLevels > 0 && (
          <Text size="xs" tone="subdued" className="px-2 py-0.5">
            Past
          </Text>
        )}

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
                    for (let i = 0; i < displayIndex; i++) {
                      undo.undo();
                    }
                  }
                }}
              />
            );
          })}
        </div>

        <InitialStateMarker
          isCurrent={undoLevels === 0}
          onClick={handleInitialClick}
        />
      </div>
    </div>
  );
});
