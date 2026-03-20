import { reaction } from "mobx";
import { useEffect } from "react";

import { RunViewContextPanel } from "@/routes/v2/pages/RunView/components/RunViewContextPanel";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  closeWindow,
  getWindowById,
  openWindow,
  restoreWindow,
} from "@/routes/v2/shared/windows/windows.actions";

const CONTEXT_PANEL_WINDOW_ID = "context-panel";

export function useRunViewSelectionSync() {
  const { editor } = useSharedStores();

  useEffect(() => {
    const dispose = reaction(
      () => ({
        selectedNodeId: editor.selectedNodeId,
        selectedNodeType: editor.selectedNodeType,
      }),
      ({ selectedNodeId, selectedNodeType }) => {
        if (selectedNodeId && selectedNodeType) {
          const existing = getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existing) {
            if (existing.state === "hidden") {
              restoreWindow(CONTEXT_PANEL_WINDOW_ID);
            }
          } else {
            openWindow(<RunViewContextPanel />, {
              id: CONTEXT_PANEL_WINDOW_ID,
              title: "Properties",
              position: { x: window.innerWidth - 340, y: 80 },
              size: { width: 300, height: 400 },
              startVisible: true,
              persisted: true,
            });
          }
        } else {
          const existing = getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existing) closeWindow(CONTEXT_PANEL_WINDOW_ID);
        }
      },
    );

    return dispose;
  }, [editor]);
}
