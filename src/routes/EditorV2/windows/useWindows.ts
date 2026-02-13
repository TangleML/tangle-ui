import type { ReactNode } from "react";
import { useSnapshot } from "valtio";

import type { WindowConfig, WindowOptions, WindowRef } from "./types";
import {
  bringToFront,
  closeWindow,
  getAllWindows,
  getHiddenWindows,
  getWindowById,
  hideWindow,
  maximizeWindow,
  minimizeWindow,
  openWindow,
  restoreWindow,
  updateWindowContent,
  windowStore,
} from "./windowStore";

export interface UseWindowsReturn {
  /** Open a new window or focus existing one with same ID */
  open: (content: ReactNode, options: WindowOptions) => WindowRef;
  /** Get a window configuration by ID */
  getById: (id: string) => WindowConfig | undefined;
  /** Get all windows */
  list: () => WindowConfig[];
  /** Get only hidden windows */
  listHidden: () => WindowConfig[];
  /** Close a window by ID */
  close: (id: string) => void;
  /** Minimize a window by ID */
  minimize: (id: string) => void;
  /** Maximize a window by ID */
  maximize: (id: string) => void;
  /** Hide a window to task panel by ID */
  hide: (id: string) => void;
  /** Restore a window from hidden/minimized/maximized state */
  restore: (id: string) => void;
  /** Bring a window to front */
  focus: (id: string) => void;
  /** Update window content */
  updateContent: (id: string, content: ReactNode) => void;
}

/**
 * Hook for managing windows in the EditorV2 windows system.
 *
 * @example
 * ```tsx
 * const { open, getById, list } = useWindows();
 *
 * const componentMarkup = <BlockStack>My Window Content</BlockStack>;
 * const options: WindowOptions = { title: "My Window", id: "my-window" };
 *
 * const windowRef = open(componentMarkup, options);
 *
 * // Later: close the window
 * windowRef.close();
 * ```
 */
export function useWindows(): UseWindowsReturn {
  // Subscribe to store changes for reactive updates
  useSnapshot(windowStore);

  const open = (content: ReactNode, options: WindowOptions): WindowRef => {
    return openWindow(content, options);
  };

  const getById = (id: string): WindowConfig | undefined => {
    return getWindowById(id);
  };

  const list = (): WindowConfig[] => {
    return getAllWindows();
  };

  const listHidden = (): WindowConfig[] => {
    return getHiddenWindows();
  };

  const close = (id: string): void => {
    closeWindow(id);
  };

  const minimize = (id: string): void => {
    minimizeWindow(id);
  };

  const maximize = (id: string): void => {
    maximizeWindow(id);
  };

  const hide = (id: string): void => {
    hideWindow(id);
  };

  const restore = (id: string): void => {
    restoreWindow(id);
  };

  const focus = (id: string): void => {
    bringToFront(id);
  };

  const updateContent = (id: string, content: ReactNode): void => {
    updateWindowContent(id, content);
  };

  return {
    open,
    getById,
    list,
    listHidden,
    close,
    minimize,
    maximize,
    hide,
    restore,
    focus,
    updateContent,
  };
}

