import { useQuery } from "@tanstack/react-query";

import { getUserQueryOptions } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";

/** What the backend answers when it does not identify anyone. */
export const UNRESOLVED_USER_ID = "Unknown";

interface ProjectAuthor {
  createdBy: string | undefined;
  isPending: boolean;
  error: Error | null;
}

/** The current project creator on the selected backend, if identified. */
export function useProjectAuthor(): ProjectAuthor {
  const { backendUrl, configured, available } = useBackend();
  const {
    data: user,
    isPending,
    error,
  } = useQuery({
    ...getUserQueryOptions(backendUrl),
    enabled: configured && available,
  });

  return {
    createdBy: user && user.id !== UNRESOLVED_USER_ID ? user.id : undefined,
    isPending,
    error,
  };
}
