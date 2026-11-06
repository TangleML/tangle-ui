import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { projectQueryDefaults } from "@/services/projects/queryDefaults";

import { fetchTeamIdentity } from "./teamIdentityService";
import { TeamsQueryKeys } from "./types";

export function useTeamIdentity(teamId: string | undefined) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: TeamsQueryKeys.Identity(teamId ?? ""),
    queryFn: () => {
      if (!teamId) {
        throw new Error("Team id is required");
      }
      return fetchTeamIdentity(teamId);
    },
    enabled: configured && available && Boolean(teamId),
    ...projectQueryDefaults,
  });
}
