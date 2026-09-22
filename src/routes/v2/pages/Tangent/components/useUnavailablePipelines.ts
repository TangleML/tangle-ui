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

/**
 * The ids of the resources naming a pipeline this browser cannot open — the
 * ordinary case in a project someone shared, since a browser-held pipeline does
 * not travel with the project that lists it.
 *
 * Empty while the lookup is still running: it reads local storage, and marking
 * every row unavailable for that moment would flicker the whole list.
 */
export function useUnavailablePipelines(
  resources: readonly ProjectResourceSummary[],
): ReadonlySet<string> {
  const { data: user } = useQuery(userQueryOptions);

  const pointers = resources.flatMap(
    (resource) => localPipelinePointerOf(resource) ?? [],
  );
  const { data: resolved } = useResolvedPointers(pointers);

  if (!resolved) return new Set();

  return new Set(
    resources.flatMap((resource) => {
      const pointer = localPipelinePointerOf(resource);
      if (!pointer) return [];

      const held = resolved[pointerKey(pointer)];
      // Only a definite negative greys a row out. A pointer that was never
      // asked about is unknown, not missing.
      if (held === undefined) return [];
      if (held === null) return resource.id;

      return pointer.localId || nameIsTrustworthyHere(resource, user?.id)
        ? []
        : resource.id;
    }),
  );
}
