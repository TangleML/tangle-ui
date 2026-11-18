import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import type { ProjectCardToolDeps } from "@/routes/v2/pages/Tangent/services/createProjectCardHandlers";

export const ProjectCardHandlersContext =
  createRequiredContext<ProjectCardToolDeps>("ProjectCardHandlersContext");

export const useProjectCardHandlers = () =>
  useRequiredContext(ProjectCardHandlersContext);
