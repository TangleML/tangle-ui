import { useQuery } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";
import { pointerKey } from "@/services/localPipelines/types";
import { useResolvedPointers } from "@/services/localPipelines/useLocalPipelines";
import { localPipelinePointerOf } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";

const UNRESOLVED_USER_ID = "Unknown";

/**
 * Whether a name is this browser's to recognise. A pointer that recorded an id
 * is safe anywhere, because ids are never reused; one that recorded only a name
 * is safe only in the browser that wrote it. Someone else's pipeline called
 * "Churn model" is not the "Churn model" this browser happens to hold, and
 * opening it would show the wrong pipeline without saying so.
 *
 * Unknown authorship is trusted: it means nobody has been shown to be someone
 * else, which is every single-user backend.
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
 * What this browser can tell you about the local pipelines a project lists:
 * which rows it cannot open — the ordinary case in a project someone shared,
 * since a browser-held pipeline does not travel with the project listing it —
 * and what the rest are called now. The name on the row is a copy taken when it
 * was added, and renaming a pipeline, in the editor or by an agent, changes the
 * pipeline rather than the copy.
 *
 * Says nothing while the lookup is still running: it reads local storage, and
 * marking every row unavailable for that moment would flicker the whole list.
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
