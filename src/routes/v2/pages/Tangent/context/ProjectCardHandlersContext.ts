import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import type { ProjectCardToolDeps } from "@/routes/v2/pages/Tangent/services/createProjectCardHandlers";

/** The project card's reads and writes, shared by the agent's tools and the chat's commands. */
export const ProjectCardHandlersContext =
  createRequiredContext<ProjectCardToolDeps>("ProjectCardHandlersContext");

export const useProjectCardHandlers = () =>
  useRequiredContext(ProjectCardHandlersContext);
