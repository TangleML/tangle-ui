import { useQueries } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";

import { getProjectResource } from "./projectResourcesService";
import { projectQueryDefaults } from "./queryDefaults";
import { namesRepository } from "./resourceDescriptor";
import type { ProjectResource, ProjectResourceSummary } from "./types";
import { ProjectResourcesQueryKeys } from "./types";

/**
 * The list endpoint omits payloads, and a link's permissions live in its
 * payload, so each linked repository is read on its own. The reads share the
 * single-resource cache, which the update mutation writes straight into.
 */
export function useLinkedRepositories(
  projectId: string,
  resources: ProjectResourceSummary[],
): ReadonlyMap<string, ProjectResource> {
  const { configured, available } = useBackend();
  const links = resources.filter(namesRepository);

  return useQueries({
    queries: links.map((link) => ({
      queryKey: ProjectResourcesQueryKeys.Id(projectId, link.id),
      queryFn: () => getProjectResource(projectId, link.id),
      enabled: configured && available,
      ...projectQueryDefaults,
    })),
    combine: (results) =>
      new Map(
        results.flatMap(({ data }) => (data ? [[data.id, data] as const] : [])),
      ),
  });
}
