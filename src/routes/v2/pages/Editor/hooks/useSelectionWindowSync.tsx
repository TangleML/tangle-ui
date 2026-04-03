import { reaction } from "mobx";
import { useEffect } from "react";

import { ContextPanelContent } from "@/routes/v2/pages/Editor/components/ContextPanel/ContextPanel";
import { PinnedTaskContent } from "@/routes/v2/pages/Editor/components/PinnedTaskContent/PinnedTaskContent";
import type { EditorStore } from "@/routes/v2/shared/store/editorStore";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

const CONTEXT_PANEL_WINDOW_ID = "context-panel";

function generatePinnedWindowId(): string {
  return `pinned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getTaskNameByEntityId(
  navigation: NavigationStore,
  entityId: string,
): string | null {
  const spec = navigation.rootSpec;
  if (!spec) return null;
  const task = spec.tasks.find((t) => t.$id === entityId);
  return task?.name ?? null;
}

function handleShiftClickPin(
  navigation: NavigationStore,
  windows: WindowStoreImpl,
  editor: EditorStore,
  entityId: string,
) {
  const taskName = getTaskNameByEntityId(navigation, entityId);
  if (taskName) {
    windows.openWindow(<PinnedTaskContent entityId={entityId} />, {
      id: generatePinnedWindowId(),
      title: taskName,
      linkedEntityId: entityId,
    });
  }
  editor.selectNode(null, null);
}

function ensureContextPanelVisible(windows: WindowStoreImpl) {
  const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);

  if (existing?.state === "hidden") {
    windows.restoreWindow(CONTEXT_PANEL_WINDOW_ID);
    return;
  }
  if (existing) return;

  windows.openWindow(<ContextPanelContent />, {
    id: CONTEXT_PANEL_WINDOW_ID,
    title: "Properties",
    position: { x: window.innerWidth - 340, y: 80 },
    size: { width: 300, height: 400 },
    startVisible: true,
    persisted: true,
  });
}

function closeContextPanel(windows: WindowStoreImpl) {
  const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);
  if (existing) windows.closeWindow(CONTEXT_PANEL_WINDOW_ID);
}

export function useSelectionWindowSync() {
  const { editor, navigation, windows } = useSharedStores();

  useEffect(() => {
    const disposeSelectionWatcher = reaction(
      () => ({
        selectedNodeId: editor.selectedNodeId,
        selectedNodeType: editor.selectedNodeType,
        lastSelectionWasShiftClick: editor.lastSelectionWasShiftClick,
        lastShiftClickEntityId: editor.lastShiftClickEntityId,
        multiSelectionLength: editor.multiSelection.length,
      }),
      ({
        selectedNodeId,
        selectedNodeType,
        lastSelectionWasShiftClick,
        lastShiftClickEntityId,
        multiSelectionLength,
      }) => {
        if (lastSelectionWasShiftClick && lastShiftClickEntityId) {
          handleShiftClickPin(
            navigation,
            windows,
            editor,
            lastShiftClickEntityId,
          );
          return;
        }

        const shouldShowPanel =
          multiSelectionLength > 1 || (selectedNodeId && selectedNodeType);

        if (shouldShowPanel) {
          ensureContextPanelVisible(windows);
        } else {
          closeContextPanel(windows);
        }
      },
    );

    return disposeSelectionWatcher;
  }, [editor, navigation, windows]);
}
