import { useRunProjectContext } from "@/components/Project/useRunProjectContext";
import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { projectIdsFromAnnotations } from "@/utils/projectRunAnnotation";

import type { TeamResolution } from "./types";
import { useTeamForProjects } from "./useTeamForProjects";

export function useActingTeam(): TeamResolution {
  const scopeProjectIds = projectIdsFromAnnotations(
    useRunSubmissionAnnotations(),
  );
  const { projectIds: linkedProjectIds } = useRunProjectContext();

  return useTeamForProjects([
    ...new Set([...scopeProjectIds, ...linkedProjectIds]),
  ]);
}
