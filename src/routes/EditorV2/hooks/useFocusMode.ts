import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { proxy } from "valtio";

import { CMDALT } from "../shortcuts/keys";
import { registerShortcut } from "../store/keyboardStore";
import { registerDockAreaPlugin } from "../windows/dockAreaPlugins";
import type { DockState } from "../windows/types";
import { getPersistedWindowState } from "../windows/windowPersistence";
import { dockWindow, undockWindow, windowStore } from "../windows/windowStore";

// todo: make const shared?
const CONTEXT_PANEL_WINDOW_ID = "context-panel";

interface FocusModeSnapshot {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  propertiesDockSide: DockState;
}

interface FocusModeStore {
  active: boolean;
  snapshot: FocusModeSnapshot | null;
}

export const focusModeStore = proxy<FocusModeStore>({
  active: false,
  snapshot: null,
});

/**
 * Resolves the dock side the Properties window is (or should be) on.
 * Checks the live window first, then falls back to persisted state so
 * we capture the intended side even when the window is currently closed.
 */
function resolvePropertiesDockSide(): DockState {
  const liveWindow = windowStore.windows[CONTEXT_PANEL_WINDOW_ID];
  if (liveWindow) return liveWindow.dockState;

  const persisted = getPersistedWindowState(CONTEXT_PANEL_WINDOW_ID);
  return persisted?.dockState ?? "none";
}

function enterFocusMode(): void {
  focusModeStore.snapshot = {
    leftCollapsed: windowStore.dockAreas.left.collapsed,
    rightCollapsed: windowStore.dockAreas.right.collapsed,
    propertiesDockSide: resolvePropertiesDockSide(),
  };

  windowStore.dockAreas.left.collapsed = true;
  windowStore.dockAreas.right.collapsed = true;

  const contextWindow = windowStore.windows[CONTEXT_PANEL_WINDOW_ID];
  if (contextWindow && contextWindow.dockState !== "none") {
    undockWindow(CONTEXT_PANEL_WINDOW_ID);
  }

  focusModeStore.active = true;
}

function exitFocusMode(): void {
  const snapshot = focusModeStore.snapshot;

  // Deactivate before re-docking so the dock-area plugin doesn't
  // intercept the dockWindow call and immediately undock again.
  focusModeStore.active = false;
  focusModeStore.snapshot = null;

  if (snapshot) {
    windowStore.dockAreas.left.collapsed = snapshot.leftCollapsed;
    windowStore.dockAreas.right.collapsed = snapshot.rightCollapsed;

    if (
      snapshot.propertiesDockSide !== "none" &&
      windowStore.windows[CONTEXT_PANEL_WINDOW_ID]
    ) {
      dockWindow(CONTEXT_PANEL_WINDOW_ID, snapshot.propertiesDockSide);
    }
  }
}

export function toggleFocusMode(fitView?: () => void): void {
  if (focusModeStore.active) {
    exitFocusMode();
  } else {
    enterFocusMode();
  }

  fitView?.();
}

/**
 * Intercepts the context-panel being docked (e.g. via persisted state restore)
 * while focus mode is active, and immediately undocks it back to floating.
 */
function handleDockEventDuringFocusMode(event: {
  type: string;
  windowId: string;
}): void {
  if (
    focusModeStore.active &&
    event.type === "window-docked" &&
    event.windowId === CONTEXT_PANEL_WINDOW_ID
  ) {
    queueMicrotask(() => undockWindow(CONTEXT_PANEL_WINDOW_ID));
  }
}

/**
 * Registers the Cmd+/ keyboard shortcut for focus mode and a dock-area
 * plugin that keeps the Properties window floating while focus mode is active.
 * Call once at the EditorV2 root level.
 */
export function useFocusMode(): void {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const unregisterShortcut = registerShortcut({
      id: "focus-mode",
      keys: [CMDALT, "/"],
      label: "Focus mode",
      action: () => toggleFocusMode(fitView),
    });

    const unregisterLeftPlugin = registerDockAreaPlugin(
      "left",
      handleDockEventDuringFocusMode,
    );
    const unregisterRightPlugin = registerDockAreaPlugin(
      "right",
      handleDockEventDuringFocusMode,
    );

    return () => {
      unregisterShortcut();
      unregisterLeftPlugin();
      unregisterRightPlugin();
      if (focusModeStore.active) {
        exitFocusMode();
      }
    };
  }, []);
}
