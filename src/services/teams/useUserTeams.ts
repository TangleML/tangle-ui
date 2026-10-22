import { useQuery } from "@tanstack/react-query";

import { projectQueryDefaults } from "@/services/projects/queryDefaults";

import { fetchTeamMemberships } from "./teamIdentityService";
import { TeamsQueryKeys } from "./types";

export function useUserTeams({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TeamsQueryKeys.Memberships(),
    queryFn: fetchTeamMemberships,
    enabled,
    ...projectQueryDefaults,
  });
}
