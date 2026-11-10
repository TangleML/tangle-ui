import type { QueryClient } from "@tanstack/react-query";

import { getProject, updateProject } from "@/services/projects/projectsService";
import { ProjectsQueryKeys } from "@/services/projects/types";

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

const lastWrite = new Map<string, Promise<unknown>>();

function afterEarlierWrites<T>(
  projectId: string,
  write: () => Promise<T>,
): Promise<T> {
  const queued = (lastWrite.get(projectId) ?? Promise.resolve()).then(
    write,
    write,
  );
  lastWrite.set(projectId, queued);
  const forget = () => {
    if (lastWrite.get(projectId) === queued) lastWrite.delete(projectId);
  };
  queued.then(forget, forget);
  return queued;
}

/**
 * Archives or restores an item for everyone in the project, then refetches the
 * project so the card shows it. The PATCH replaces the whole metadata object,
 * so the project is read again just before, and a project's changes are saved
 * one at a time: two that overlapped would each write back a list without the
 * other's item.
 */
export async function setProjectItemArchived(
  queryClient: QueryClient,
  projectId: string,
  target: string,
  archived: boolean,
): Promise<void> {
  await afterEarlierWrites(projectId, async () => {
    const latest = await getProject(projectId);
    await updateProject(projectId, {
      metadata: withArchived(latest.metadata, target, archived),
    });
  });
  await queryClient.invalidateQueries({
    queryKey: ProjectsQueryKeys.Id(projectId),
    exact: true,
  });
}
