import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { WindowModel } from "./windowModel";

interface WindowContextValue {
  model: WindowModel;
  content: ReactNode;
  dockIndex?: number;
}

const WindowCtx = createContext<WindowContextValue | undefined>(undefined);

WindowCtx.displayName = "WindowContext";

export function WindowContextProvider({
  value,
  children,
}: {
  value: WindowContextValue;
  children: ReactNode;
}) {
  return <WindowCtx.Provider value={value}>{children}</WindowCtx.Provider>;
}

/** Returns the window context. Throws when rendered outside a window. */
export function useWindowContext(): WindowContextValue {
  const ctx = useContext(WindowCtx);
  if (!ctx) {
    throw new Error(
      "useWindowContext must be used within a WindowContextProvider",
    );
  }
  return ctx;
}

/** Returns the window context, or `undefined` when rendered outside a window. */
export function useOptionalWindowContext(): WindowContextValue | undefined {
  return useContext(WindowCtx);
}
