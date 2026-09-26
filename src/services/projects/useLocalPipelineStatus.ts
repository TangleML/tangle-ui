import { useQuery } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";
import { pointerKey } from "@/services/localPipelines/types";
import { useResolvedPointers } from "@/services/localPipelines/useLocalPipelines";
import { localPipelinePointerOf } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";

const UNRESOLVED_USER_ID = "Unknown";

/**
 * A name-only pointer is safe only in the browser that wrote it: someone else's
 * "Churn model" is not the one this browser holds, and opening it would show
 * the wrong pipeline without saying so. Unknown authorship is trusted, which is
 * every single-user backend.
 */
function nameIsTrustworthyHere(
  resource: ProjectResourceSummary,
  userId: string | undefined,
): boolean {
  if (!userId || userId === UNRESOLVED_USER_ID) return true;
  return resource.createdBy === null || resource.createdBy === userId;
}

export interface LocalPipelineStatus {
  unavailable: ReadonlySet<string>;
  currentNames: ReadonlyMap<string, string>;
}

const NOTHING_KNOWN_YET: LocalPipelineStatus = {
  unavailable: new Set(),
  currentNames: new Map(),
};

/**
 * A browser-held pipeline does not travel with the project listing it, so rows
 * this browser cannot open are the ordinary case in a shared project. The name
 * on a row is a copy taken when it was added; renaming the pipeline changes the
 * pipeline, not the copy, so current names are looked up rather than read off.
 *
 * Says nothing while the lookup runs: marking every row unavailable for that
 * moment would flicker the whole list.
 */
export function useLocalPipelineStatus(
  resources: readonly ProjectResourceSummary[],
): LocalPipelineStatus {
  const { data: user } = useQuery(userQueryOptions);

  const pointers = resources.flatMap(
    (resource) => localPipelinePointerOf(resource) ?? [],
  );
  const { data: resolved } = useResolvedPointers(pointers);

  if (!resolved) return NOTHING_KNOWN_YET;

  const unavailable = new Set<string>();
  const currentNames = new Map<string, string>();

  for (const resource of resources) {
    const pointer = localPipelinePointerOf(resource);
    if (!pointer) continue;

    const held = resolved[pointerKey(pointer)];
    // Only a definite negative greys a row out. A pointer that was never asked
    // about is unknown, not missing.
    if (held === undefined) continue;
    if (held === null) {
      unavailable.add(resource.id);
      continue;
    }

    if (pointer.localId || nameIsTrustworthyHere(resource, user?.id)) {
      currentNames.set(resource.id, held);
    } else {
      unavailable.add(resource.id);
    }
  }

  return { unavailable, currentNames };
}
