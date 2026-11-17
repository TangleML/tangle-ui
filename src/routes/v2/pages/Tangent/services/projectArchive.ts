import type { QueryClient } from "@tanstack/react-query";

import { ProjectsQueryKeys } from "@/services/projects/types";
import { updateProjectMetadata } from "@/services/projects/updateProjectMetadata";

const ARCHIVED_KEY = "tangentArchived";

/** The workarea targets archived out of the project card, e.g. `run://id/…`. */
export function archivedTargets(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  const value = metadata?.[ARCHIVED_KEY];
  return Array.isArray(value)
    ? value.filter((target): target is string => typeof target === "string")
    : [];
}

export function withArchived(
  metadata: Record<string, unknown> | null | undefined,
  target: string,
  archived: boolean,
): Record<string, unknown> {
  const targets = new Set(archivedTargets(metadata));
  if (archived) {
    targets.add(target);
  } else {
    targets.delete(target);
  }
  return { ...metadata, [ARCHIVED_KEY]: [...targets] };
}

/**
 * Archives or restores an item for everyone in the project, then refetches the
 * project so the card shows it.
 */
export async function setProjectItemArchived(
  queryClient: QueryClient,
  projectId: string,
  target: string,
  archived: boolean,
): Promise<void> {
  await updateProjectMetadata(projectId, (metadata) =>
    withArchived(metadata, target, archived),
  );
  await queryClient.invalidateQueries({
    queryKey: ProjectsQueryKeys.Id(projectId),
    exact: true,
  });
}
