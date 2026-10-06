import { useQuery } from "@tanstack/react-query";

import { userQueryOptions } from "@/hooks/useUserDetails";

/** What the backend answers when it does not identify anyone. */
export const UNRESOLVED_USER_ID = "Unknown";

interface ProjectAuthor {
  createdBy: string | undefined;
  isPending: boolean;
  error: Error | null;
}

/**
 * Who to file and filter a project under. A backend that identifies nobody
 * answers `Unknown`, and every reader treats that as nobody to filter by rather
 * than as a failure — on a single-user backend an unfiltered list is that
 * user's. A lookup that did not answer at all is the failure, because there a
 * list would be everyone's with nothing saying so.
 */
export function useProjectAuthor(): ProjectAuthor {
  const { data: user, isPending, error } = useQuery(userQueryOptions);

  return {
    createdBy: user && user.id !== UNRESOLVED_USER_ID ? user.id : undefined,
    isPending,
    error,
  };
}
