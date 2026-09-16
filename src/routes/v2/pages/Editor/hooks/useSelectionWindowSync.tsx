import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { ContextPanelContent } from "@/routes/v2/pages/Editor/components/ContextPanel/ContextPanel";
import { PinnedTaskContent } from "@/routes/v2/pages/Editor/components/PinnedTaskContent/PinnedTaskContent";
import { useDeselectAll } from "@/routes/v2/shared/hooks/useDeselectAll";
import type { EditorStore } from "@/routes/v2/shared/store/editorStore";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
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

const CONTEXT_WINDOW_HEIGHT = 460;
const CONTEXT_WINDOW_WIDTH = 310;

function scrollWindowIntoView() {
  // MobX needs a tick to re-render the new docked window into the DOM
  setTimeout(() => {
    const header = document.querySelector(
      `[data-dock-window="${CONTEXT_PANEL_WINDOW_ID}"]`,
    );
    if (!header) return;

    const scrollContainer = header.closest("[data-dock-scroll]");
    if (!scrollContainer) return;

    // Count how many sticky headers are above this one (they consume space at the top)
    const stickyHeaders =
      scrollContainer.querySelectorAll("[data-dock-window]");
    let stickyOffset = 0;
    for (const h of stickyHeaders) {
      if (h === header) break;
      stickyOffset += h.getBoundingClientRect().height;
    }

    // Find the sentinel (h-0 div) right before the header
    const sentinel = header.previousElementSibling;
    const target = sentinel ?? header;

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollTop =
      scrollContainer.scrollTop +
      (targetRect.top - containerRect.top) -
      stickyOffset;

    scrollContainer.scrollTo({ top: scrollTop, behavior: "smooth" });
  }, 100);
}

function ensureContextPanelVisible(
  windows: WindowStoreImpl,
  deselectAll: () => void,
  placement: ContextPanelPlacement,
) {
  const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);

  if (existing) {
    // Always restore (expand) — the accordion plugin will collapse others
    if (existing.state === "hidden" || existing.isMinimized) {
      existing.restore();
    }
    scrollWindowIntoView();
    return;
  }

  windows.openWindow(<ContextPanelContent />, {
    id: CONTEXT_PANEL_WINDOW_ID,
    title: "Properties",
    position: placement.getInitialPosition?.() ?? {
      x: window.innerWidth - CONTEXT_WINDOW_WIDTH - 40,
      y: 80,
    },
    size: { width: CONTEXT_WINDOW_WIDTH, height: CONTEXT_WINDOW_HEIGHT },
    startVisible: true,
    persisted: true,
    defaultDockState: placement.defaultDockState,
    disabledActions: ["hide"],
    onClose: deselectAll,
    miniContent: (
      <WindowMiniButton
        tooltip="View Properties"
        label="Properties"
        icon="SlidersHorizontal"
      />
    ),
  });
  scrollWindowIntoView();
}

function closeContextPanel(windows: WindowStoreImpl) {
  const existing = windows.getWindowById(CONTEXT_PANEL_WINDOW_ID);
  if (existing) windows.closeWindow(CONTEXT_PANEL_WINDOW_ID);
}

export function useSelectionWindowSync(options?: {
  contextPanel?: ContextPanelPlacement;
}) {
  const { editor, navigation, windows } = useSharedStores();
  const deselectAll = useDeselectAll();
  const placement = options?.contextPanel ?? DEFAULT_CONTEXT_PANEL_PLACEMENT;
  const placementRef = useRef(placement);
  placementRef.current = placement;

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
          ensureContextPanelVisible(windows, deselectAll, placementRef.current);
        } else {
          closeContextPanel(windows);
        }
      },
    );

    return disposeSelectionWatcher;
  }, [editor, navigation, windows, deselectAll]);
}
