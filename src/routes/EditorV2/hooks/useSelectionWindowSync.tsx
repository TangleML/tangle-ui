import { reaction } from "mobx";
import { useEffect } from "react";

import { ContextPanelContent } from "../components/ContextPanel/ContextPanel";
import { PinnedTaskContent } from "../components/PinnedTaskContent";
import { editorStore } from "../store/editorStore";
import {
  closeWindow,
  getWindowById,
  openWindow,
  restoreWindow,
} from "../windows/windowStore";

const CONTEXT_PANEL_WINDOW_ID = "context-panel";

function generatePinnedWindowId(): string {
  return `pinned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getTaskNameByEntityId(entityId: string): string | null {
  const spec = editorStore.spec;
  if (!spec) return null;
  const task = spec.tasks.find((t) => t.$id === entityId);
  return task?.name ?? null;
}

export function useSelectionWindowSync() {
  useEffect(() => {
    const disposeSelectionWatcher = reaction(
      () => ({
        selectedNodeId: editorStore.selectedNodeId,
        selectedNodeType: editorStore.selectedNodeType,
        lastSelectionWasShiftClick: editorStore.lastSelectionWasShiftClick,
        lastShiftClickEntityId: editorStore.lastShiftClickEntityId,
        multiSelectionLength: editorStore.multiSelection.length,
      }),
      ({
        selectedNodeId,
        selectedNodeType,
        lastSelectionWasShiftClick,
        lastShiftClickEntityId,
        multiSelectionLength,
      }) => {
        if (lastSelectionWasShiftClick && lastShiftClickEntityId) {
          const taskName = getTaskNameByEntityId(lastShiftClickEntityId);
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
          editorStore.selectNode(null, null);
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
            });
          }
        } else {
          const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existingWindow) closeWindow(CONTEXT_PANEL_WINDOW_ID);
        }
      },
    );

    return disposeSelectionWatcher;
  }, []);
}
