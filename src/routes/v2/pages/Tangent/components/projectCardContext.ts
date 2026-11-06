import { createContext, useContext } from "react";

/** Closes the project card; a no-op for content shown anywhere else. */
export const ProjectCardDismissContext = createContext<() => void>(() => {});

export function useDismissProjectCard(): () => void {
  return useContext(ProjectCardDismissContext);
}
