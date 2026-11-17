import { createContext, useContext } from "react";

import type { ProjectCardToolDeps } from "@/routes/v2/pages/Tangent/services/createProjectCardRemoteTools";

export const ProjectCardHandlersContext =
  createContext<ProjectCardToolDeps | null>(null);

export function useProjectCardHandlers(): ProjectCardToolDeps {
  const handlers = useContext(ProjectCardHandlersContext);
  if (!handlers) {
    throw new Error(
      "useProjectCardHandlers must be used within TangentProjectAgentProvider",
    );
  }
  return handlers;
}
