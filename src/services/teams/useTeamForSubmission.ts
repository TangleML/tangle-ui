import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { projectIdsFromAnnotations } from "@/utils/projectRunAnnotation";

import type { TeamResolution } from "./types";
import { useTeamForProjects } from "./useTeamForProjects";

export function useTeamForSubmission(
  projectIds: readonly string[],
): TeamResolution {
  const scopeProjectIds = projectIdsFromAnnotations(
    useRunSubmissionAnnotations(),
  );

  return useTeamForProjects([...new Set([...scopeProjectIds, ...projectIds])]);
}
