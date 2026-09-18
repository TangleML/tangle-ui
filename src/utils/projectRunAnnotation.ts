import { PROJECT_ID_ANNOTATION_PREFIX } from "./annotationKeys";

/**
 * A run says which projects it belongs to by carrying one annotation per
 * project, the id in the key and a constant value. So these are a set of
 * memberships rather than a single field, and a run may sit in several
 * projects at once.
 *
 * The key cannot be written after the fact: the endpoint that sets a single
 * annotation takes the key as a path segment and rejects this one for its
 * slashes. Attribution therefore has to be right when the run is created.
 */
const MEMBER = "true";

export const projectRunAnnotationKey = (projectId: string) =>
  `${PROJECT_ID_ANNOTATION_PREFIX}${projectId}`;

export function projectRunAnnotations(
  projectIds: readonly string[],
): Record<string, string> {
  const annotations: Record<string, string> = {};
  for (const projectId of projectIds) {
    const trimmed = projectId.trim();
    if (trimmed !== "") {
      annotations[projectRunAnnotationKey(trimmed)] = MEMBER;
    }
  }
  return annotations;
}

/** Annotations come off a run, so any key may be anything at all. */
export function projectIdsFromAnnotations(
  annotations: Record<string, unknown> | null | undefined,
): string[] {
  if (!annotations) {
    return [];
  }

  const ids: string[] = [];
  for (const key of Object.keys(annotations)) {
    if (!key.startsWith(PROJECT_ID_ANNOTATION_PREFIX)) {
      continue;
    }
    const id = key.slice(PROJECT_ID_ANNOTATION_PREFIX.length);
    if (id !== "" && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}
