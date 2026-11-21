import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";

import {
  fetchManagedAccess,
  fetchManagedRepositoryIds,
} from "./githubBackendClient";

const MANAGED_ACCESS_STALE_MS = 5 * 60 * 1000;
const MANAGED_REPOSITORIES_STALE_MS = 60 * 1000;
const NO_REPOSITORIES: ReadonlySet<string> = new Set();

const ManagedAccessQueryKeys = {
  Access: (backendUrl: string) =>
    ["github", "managed-access", backendUrl] as const,
  Repositories: (backendUrl: string, projectId: string) =>
    ["github", "managed-repositories", backendUrl, projectId] as const,
} as const;

export interface ManagedRepositories {
  label: string | null;
  isManaged: (resourceId: string) => boolean;
}

/**
 * Which of a project's repository links the backend reads through its managed
 * access rather than a person's token, and what it calls that access. Both
 * answers are the backend's, so the UI names no provider itself.
 */
export function useManagedRepositories(projectId: string): ManagedRepositories {
  const { available, backendUrl } = useBackend();
  const access = useQuery({
    queryKey: ManagedAccessQueryKeys.Access(backendUrl),
    queryFn: () => fetchManagedAccess(backendUrl),
    enabled: available,
    staleTime: MANAGED_ACCESS_STALE_MS,
    retry: false,
  });
  const repositories = useQuery({
    queryKey: ManagedAccessQueryKeys.Repositories(backendUrl, projectId),
    queryFn: () => fetchManagedRepositoryIds(backendUrl, projectId),
    enabled: available && access.data != null,
    staleTime: MANAGED_REPOSITORIES_STALE_MS,
    retry: false,
  });
  const ids = repositories.data ?? NO_REPOSITORIES;
  return {
    label: access.data?.label ?? null,
    isManaged: (resourceId) => ids.has(resourceId),
  };
}
