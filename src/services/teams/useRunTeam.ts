import { useQuery } from "@tanstack/react-query";

import { useProjectsEnabled } from "@/components/shared/Settings/useFlags";
import { getTeamImpersonationHeaderName } from "@/config/teamImpersonation";
import { useBackend } from "@/providers/BackendProvider";
import { runAnnotationsQueryOptions } from "@/services/runAnnotations";
import { projectIdsFromAnnotations } from "@/utils/projectRunAnnotation";

import type { TeamResolution } from "./types";
import { useTeamForSubmission } from "./useTeamForSubmission";

export function useRunTeam(
  runId: string | number | null | undefined,
): TeamResolution {
  const { backendUrl } = useBackend();
  const projectsEnabled = useProjectsEnabled();
  const teamsConfigured = getTeamImpersonationHeaderName() !== null;
  const annotations = useQuery({
    ...runAnnotationsQueryOptions(runId ?? undefined, backendUrl),
    enabled:
      teamsConfigured &&
      projectsEnabled &&
      runId != null &&
      String(runId) !== "",
  });
  const team = useTeamForSubmission(
    projectIdsFromAnnotations(annotations.data),
  );

  if (!teamsConfigured) return { status: "none" };
  if (annotations.isLoading) return { status: "resolving" };
  if (annotations.isError) {
    return { status: "error", error: annotations.error };
  }
  return team;
}
