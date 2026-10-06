import { useState } from "react";

import { useRunProjectContext } from "@/components/Project/useRunProjectContext";

interface RunAttribution {
  projectId: string | undefined;
  setProjectId: (projectId: string | undefined) => void;
  resetToContext: () => void;
  defaultProjectIds: string[];
  chosenProjectIds: string[];
}

/**
 * Which project a run about to be submitted is filed under. The surrounding
 * page has an answer already — the project whose page the editor was opened
 * from — and the arguments dialog is where it can be changed for one run.
 *
 * The choice is reset to the page's each time the dialog opens, so a run
 * redirected once does not silently redirect the next one too. A run submitted
 * without the dialog takes the page's answer, which is what
 * `defaultProjectIds` carries.
 */
export function useRunAttribution(): RunAttribution {
  const { projectId: contextProjectId, projectIds } = useRunProjectContext();
  const [projectId, setProjectId] = useState<string | undefined>(
    contextProjectId,
  );

  return {
    projectId,
    setProjectId,
    resetToContext: () => setProjectId(contextProjectId),
    defaultProjectIds: projectIds,
    chosenProjectIds: projectId ? [projectId] : [],
  };
}
