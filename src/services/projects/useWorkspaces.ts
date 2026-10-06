import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";

import { projectQueryDefaults } from "./queryDefaults";
import { WorkspacesQueryKeys } from "./types";
import { getWorkspace, listWorkspaces } from "./workspacesService";

export function useWorkspaces() {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: WorkspacesQueryKeys.All(),
    queryFn: listWorkspaces,
    enabled: configured && available,
    ...projectQueryDefaults,
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
    ...projectQueryDefaults,
  });
}
