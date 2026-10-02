import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { RunViewContextPanel } from "@/routes/v2/pages/RunView/components/RunViewContextPanel";
import type { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { Position } from "@/routes/v2/shared/windows/types";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

const CONTEXT_PANEL_WINDOW_ID = "context-panel";

interface ContextPanelPlacement {
  defaultDockState?: "left" | "right";
  getInitialPosition?: () => Position;
}

const DEFAULT_CONTEXT_PANEL_PLACEMENT: ContextPanelPlacement = {
  defaultDockState: "right",
};

function ensureContextPanelVisible(
  windows: WindowStoreImpl,
  editor: EditorStore,
  placement: ContextPanelPlacement,
) {
  const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);
  if (existing) {
    if (existing.state === "hidden") {
      windows.restoreWindow(CONTEXT_PANEL_WINDOW_ID);
    }
    return;
  }

  windows.openWindow(<RunViewContextPanel />, {
    id: CONTEXT_PANEL_WINDOW_ID,
    title: "Properties",
    position: placement.getInitialPosition?.() ?? {
      x: window.innerWidth - 340,
      y: 80,
    },
    size: { width: 300, height: 500 },
    startVisible: true,
    persisted: true,
    fillDockHeight: placement.defaultDockState !== undefined,
    defaultDockState: placement.defaultDockState,
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
    const disposeSelectionWatcher = reaction(
      () => ({
        selectedNodeId: editor.selectedNodeId,
        selectedNodeType: editor.selectedNodeType,
      }),
      ({ selectedNodeId, selectedNodeType }) => {
        if (!selectedNodeId || !selectedNodeType) {
          const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);
          if (existing) windows.closeWindow(CONTEXT_PANEL_WINDOW_ID);
          return;
        }

        if (editor.draggedSincePointerDown) return;

        ensureContextPanelVisible(windows, editor, placementRef.current);
      },
    );

    const disposeRevealWatcher = reaction(
      () => editor.contextPanelRevealCount,
      (count) => {
        if (count === 0 || !editor.selectedNodeId) return;
        ensureContextPanelVisible(windows, editor, placementRef.current);
      },
    );

    return () => {
      disposeSelectionWatcher();
      disposeRevealWatcher();
    };
  }, [editor, windows]);
}
