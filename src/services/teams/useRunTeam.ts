import { useQuery } from "@tanstack/react-query";

import { useProjectsEnabled } from "@/components/shared/Settings/useFlags";
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
  const annotations = useQuery({
    ...runAnnotationsQueryOptions(runId ?? undefined, backendUrl),
    enabled: projectsEnabled && runId != null && String(runId) !== "",
  });
  const team = useTeamForSubmission(
    projectIdsFromAnnotations(annotations.data),
  );

  if (annotations.isLoading) return { status: "resolving" };
  if (annotations.isError) {
    return { status: "error", error: annotations.error };
  }
  return team;
}
