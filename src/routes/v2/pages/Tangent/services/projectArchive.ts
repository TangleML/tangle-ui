import { getProject, updateProject } from "@/services/projects/projectsService";
import type { Project } from "@/services/projects/types";

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
 * Archives or restores an item for everyone in the project. The PATCH replaces
 * the whole metadata object, so the project is read again just before.
 */
export async function setProjectItemArchived(
  projectId: string,
  target: string,
  archived: boolean,
): Promise<Project> {
  const latest = await getProject(projectId);
  return updateProject(projectId, {
    metadata: withArchived(latest.metadata, target, archived),
  });
}
