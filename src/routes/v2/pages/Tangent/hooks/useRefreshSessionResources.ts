import { useQueryClient } from "@tanstack/react-query";

import { sessionResourcesKey } from "@/routes/v2/pages/Tangent/services/sessionResources";

/**
 * Refetches what this page built from a chat's Tangent resources: its files
 * and reports on the project card, and its runs pill. The chat calls it when
 * an agent or another person changes them, so nothing waits for a reload.
 */
export function useRefreshSessionResources() {
  const queryClient = useQueryClient();

  return (sessionId: string) => {
    void queryClient.invalidateQueries({
      queryKey: sessionResourcesKey(sessionId),
    });
  };
}
