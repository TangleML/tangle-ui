/**
 * todo: refactor to reduce if-nesting and improve readability
 */
import { reaction } from "mobx";
import { useEffect } from "react";

import { ContextPanelContent } from "@/routes/v2/pages/Editor/components/ContextPanel/ContextPanel";
import { PinnedTaskContent } from "@/routes/v2/pages/Editor/components/PinnedTaskContent/PinnedTaskContent";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  closeWindow,
  getWindowById,
  openWindow,
  restoreWindow,
} from "@/routes/v2/shared/windows/windows.actions";

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

export function useSelectionWindowSync() {
  const { editor, navigation } = useSharedStores();

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
          const taskName = getTaskNameByEntityId(
            navigation,
            lastShiftClickEntityId,
          );
          if (taskName) {
            openWindow(
              <PinnedTaskContent entityId={lastShiftClickEntityId} />,
              {
                id: generatePinnedWindowId(),
                title: taskName,
                linkedEntityId: lastShiftClickEntityId,
              },
            );
          }
          editor.selectNode(null, null);
          return;
        }

        if (multiSelectionLength > 1) {
          const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existingWindow) {
            if (existingWindow.state === "hidden")
              restoreWindow(CONTEXT_PANEL_WINDOW_ID);
          } else {
            openWindow(<ContextPanelContent />, {
              id: CONTEXT_PANEL_WINDOW_ID,
              title: "Properties",
              position: { x: window.innerWidth - 340, y: 80 },
              size: { width: 300, height: 400 },
              startVisible: true,
              persisted: true,
            });
          }
          return;
        }

        if (selectedNodeId && selectedNodeType) {
          const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existingWindow) {
            if (existingWindow.state === "hidden")
              restoreWindow(CONTEXT_PANEL_WINDOW_ID);
          } else {
            openWindow(<ContextPanelContent />, {
              id: CONTEXT_PANEL_WINDOW_ID,
              title: "Properties",
              position: { x: window.innerWidth - 340, y: 80 },
              size: { width: 300, height: 400 },
              startVisible: true,
              persisted: true,
            });
          }
        } else {
          const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existingWindow) closeWindow(CONTEXT_PANEL_WINDOW_ID);
        }
      },
    );

    return disposeSelectionWatcher;
  }, [editor, navigation]);
}
