import { useNavigate, useSearch } from "@tanstack/react-router";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import {
  PROJECT_ID_SEARCH_PARAM,
  readProjectIdParam,
} from "@/routes/projectRunSearch";
import { isProjectGone } from "@/services/projects/errors";
import { useProject } from "@/services/projects/useProjects";

/**
 * Held in the URL so a reload keeps it, a duplicated tab carries it, and the
 * picker and the submitter read one value rather than two copies.
 *
 * The id arrives from a link or a bookmark, so it is used only once a project
 * answers to it: an id naming nothing would otherwise attribute the run to a
 * project nobody can see, permanently.
 */
export function useRunProjectContext() {
  const enabled = useFlagValue("projects");
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  const claimedId = enabled ? readProjectIdParam(search) : undefined;
  const { data: project, error } = useProject(claimedId);

  const projectId = isProjectGone(error) ? undefined : claimedId;

  const setProjectId = (next: string | undefined) => {
    void navigate({
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        [PROJECT_ID_SEARCH_PARAM]: next,
      }),
    } as never);
  };

  return {
    enabled,
    projectId,
    projectName: project?.name,
    projectIds: projectId ? [projectId] : [],
    setProjectId,
    dismiss: () => setProjectId(undefined),
  };
}
