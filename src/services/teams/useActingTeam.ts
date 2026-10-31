import { useRunProjectContext } from "@/components/Project/useRunProjectContext";

import type { TeamResolution } from "./types";
import { useTeamForSubmission } from "./useTeamForSubmission";

export function useActingTeam(): TeamResolution {
  const { projectIds } = useRunProjectContext();
  return useTeamForSubmission(projectIds);
}
