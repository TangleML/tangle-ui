import { createContext, type ReactNode, useContext } from "react";

import type { TaskNodeOutput } from "./TaskNode";

type RenderOutputAction = (output: TaskNodeOutput) => ReactNode;

const OutputActionsContext = createContext<RenderOutputAction | null>(null);

export const OutputActionsProvider = OutputActionsContext.Provider;

/**
 * Returns the optional per-output action renderer supplied by a surrounding
 * provider (e.g. RunView). Returns null when no provider is present, so the
 * shared TaskNodeCard stays decoupled from execution-specific behavior.
 */
export function useOutputAction(): RenderOutputAction | null {
  return useContext(OutputActionsContext);
}
