import { useResolvedPointers } from "@/services/localPipelines/useLocalPipelines";
import { localPipelinePointerOf } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";

/**
 * Which of these resources point at a pipeline held in a browser that is not
 * this one. A project is shareable but a browser-held pipeline is not, so the
 * rows for someone else's pipelines have to be told apart from the ones that
 * will actually open.
 *
 * Empty while the lookup is still running: it reads local storage, and marking
 * every row unavailable for that moment would flicker the whole list.
 */
export function useAbsentLocalPipelines(
  resources: readonly ProjectResourceSummary[],
): ReadonlySet<string> {
  const pointers = resources.flatMap(
    (resource) => localPipelinePointerOf(resource) ?? [],
  );

  const { data: resolved } = useResolvedPointers(pointers);

  return new Set(
    Object.entries(resolved ?? {})
      .filter(([, storageKey]) => storageKey === null)
      .map(([key]) => key),
  );
}
