import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { RunViewContextPanel } from "@/routes/v2/pages/RunView/components/RunViewContextPanel";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { Position } from "@/routes/v2/shared/windows/types";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

const CONTEXT_PANEL_WINDOW_ID = "context-panel";

interface ContextPanelPlacement {
  defaultDockState?: "left" | "right";
  getInitialPosition?: () => Position;
}

const DEFAULT_CONTEXT_PANEL_PLACEMENT: ContextPanelPlacement = {
  defaultDockState: "right",
};

export function useRunViewSelectionSync(options?: {
  contextPanel?: ContextPanelPlacement;
}) {
  const { editor, windows } = useSharedStores();
  const placement = options?.contextPanel ?? DEFAULT_CONTEXT_PANEL_PLACEMENT;
  const placementRef = useRef(placement);

  useEffect(() => {
    placementRef.current = placement;
  });

  useEffect(() => {
    const dispose = reaction(
      () => ({
        selectedNodeId: editor.selectedNodeId,
        selectedNodeType: editor.selectedNodeType,
      }),
      ({ selectedNodeId, selectedNodeType }) => {
        if (selectedNodeId && selectedNodeType) {
          const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existing) {
            if (existing.state === "hidden") {
              windows.restoreWindow(CONTEXT_PANEL_WINDOW_ID);
            }
          } else {
            const activePlacement = placementRef.current;
            windows.openWindow(<RunViewContextPanel />, {
              id: CONTEXT_PANEL_WINDOW_ID,
              title: "Properties",
              position: activePlacement.getInitialPosition?.() ?? {
                x: window.innerWidth - 340,
                y: 80,
              },
              size: { width: 300, height: 500 },
              startVisible: true,
              persisted: true,
              fillDockHeight: activePlacement.defaultDockState !== undefined,
              defaultDockState: activePlacement.defaultDockState,
              onClose: () => editor.clearSelection(),
              miniContent: (
                <WindowMiniButton
                  tooltip="View Properties"
                  label="Properties"
                  icon="SlidersHorizontal"
                />
              ),
            });
            // Selecting a node is an explicit request to see properties, so force
            // the panel visible even if a persisted layout restored it as hidden.
            windows.restoreWindow(CONTEXT_PANEL_WINDOW_ID);
          }
        } else {
          const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existing) windows.closeWindow(CONTEXT_PANEL_WINDOW_ID);
        }
      },
    );

    return dispose;
  }, [editor, windows]);
}
