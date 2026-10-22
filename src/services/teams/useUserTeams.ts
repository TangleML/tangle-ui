import { useQuery } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";

import { readTeamMemberships } from "./teamMemberships";

export function useUserTeams({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    ...userQueryOptions,
    select: readTeamMemberships,
    enabled,
  });
}
