import { createContext, type ReactNode, useContext } from "react";

import { buildProjectRunAnnotationKey } from "@/utils/annotations";

const RunSubmissionAnnotationsContext = createContext<Record<string, string>>(
  {},
);

interface RunSubmissionScopeProviderProps {
  projectId?: string;
  children: ReactNode;
}

export function RunSubmissionScopeProvider({
  projectId,
  children,
}: RunSubmissionScopeProviderProps) {
  const annotations = projectId
    ? { [buildProjectRunAnnotationKey(projectId)]: "true" }
    : {};

  return (
    <RunSubmissionAnnotationsContext.Provider value={annotations}>
      {children}
    </RunSubmissionAnnotationsContext.Provider>
  );
}

export function useRunSubmissionAnnotations(): Record<string, string> {
  return useContext(RunSubmissionAnnotationsContext);
}
