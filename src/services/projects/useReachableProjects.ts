import { MAX_PAGE_SIZE } from "./queryDefaults";
import type { ProjectSummary } from "./types";
import { usePinnedProjects } from "./usePinnedProjects";
import { useProjectAuthor } from "./useProjectAuthor";
import { useProjects } from "./useProjects";

interface ReachableProjects {
  projects: ProjectSummary[];
  isPending: boolean;
  error: Error | null;
}

/**
 * The projects a caller can actually get back to: the ones they created, plus
 * the ones they pinned. Pinning is the only record of a project someone shared,
 * so without it a shared project is gone with the link — which makes these two
 * together the whole of what a picker can honestly offer.
 *
 * Asking for every project instead spends the one page the API will return on
 * a deployment's worth of other people's work, which is how a picker came to
 * miss projects of the caller's own.
 */
export function useReachableProjects({
  enabled = true,
}: { enabled?: boolean } = {}): ReachableProjects {
  const {
    createdBy,
    isPending: isAuthorPending,
    error: authorError,
  } = useProjectAuthor();

  const {
    data,
    isPending: isListPending,
    error: listError,
  } = useProjects(
    { createdBy, pageSize: MAX_PAGE_SIZE },
    { enabled: enabled && !isAuthorPending && authorError === null },
  );

  const { projects: pinned, isPending: isPinnedPending } = usePinnedProjects();

  const mine = data?.items ?? [];
  const pinnedIds = new Set(pinned.map((project) => project.id));

  return {
    // Pinned lead, as they do on the dashboard, and a pinned project of the
    // caller's own is dropped from the tail rather than listed twice.
    projects: [
      ...pinned,
      ...mine.filter((project) => !pinnedIds.has(project.id)),
    ],
    isPending:
      enabled &&
      authorError === null &&
      (isAuthorPending || isListPending || isPinnedPending),
    error: authorError ?? listError,
  };
}
