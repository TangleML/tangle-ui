import { projectIdsFromAnnotations } from "@/utils/projectRunAnnotation";

import type { TeamResolution } from "./types";
import { useTeamForProjects } from "./useTeamForProjects";

export function useTeamForRunAnnotations(
  annotations: Record<string, unknown> | null | undefined,
): TeamResolution {
  return useTeamForProjects(projectIdsFromAnnotations(annotations));
}
