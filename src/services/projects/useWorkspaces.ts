import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import { WorkspacesQueryKeys } from "./types";
import { getWorkspace, listWorkspaces } from "./workspacesService";

export function useWorkspaces() {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: WorkspacesQueryKeys.All(),
    queryFn: listWorkspaces,
    enabled: configured && available,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

export function useWorkspace(id: string | undefined) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: WorkspacesQueryKeys.Id(id ?? ""),
    queryFn: () => {
      if (!id) {
        throw new Error("Workspace id is required");
      }
      return getWorkspace(id);
    },
    enabled: configured && available && Boolean(id),
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}
