import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { DockState, WindowState } from "./types";

export interface ContentWindowState {
  windowId: string;
  state: WindowState;
  isMaximized: boolean;
  isMinimized: boolean;
  isDocked: boolean;
  dockSide: DockState;
  dockAreaCollapsed: boolean;
  isAttached: boolean;
}

const ContentWindowStateContext = createContext<ContentWindowState | undefined>(
  undefined,
);

ContentWindowStateContext.displayName = "ContentWindowState";

export function ContentWindowStateProvider({
  value,
  children,
}: {
  value: ContentWindowState;
  children: ReactNode;
}) {
  return (
    <ContentWindowStateContext.Provider value={value}>
      {children}
    </ContentWindowStateContext.Provider>
  );
}

export function useContentWindowState(): ContentWindowState | undefined {
  return useContext(ContentWindowStateContext);
}
