import { createContext, useContext } from "react";

/**
 * Editor-only actions for rewiring a task input that is bound to a graph input.
 *
 * Lives in shared node code so `TaskNodeCard` can consume it, but is only
 * provided by the Editor (RunView leaves it `null`, disabling the feature).
 */
export interface InputConnectionActions {
  changeInputConnection: (
    taskEntityId: string,
    inputName: string,
    sourceInputEntityId: string,
    sourceInputName: string,
  ) => void;
  disconnectInput: (taskEntityId: string, inputName: string) => void;
}

const InputConnectionActionsContext =
  createContext<InputConnectionActions | null>(null);

export const InputConnectionActionsProvider =
  InputConnectionActionsContext.Provider;

export function useInputConnectionActions(): InputConnectionActions | null {
  return useContext(InputConnectionActionsContext);
}
