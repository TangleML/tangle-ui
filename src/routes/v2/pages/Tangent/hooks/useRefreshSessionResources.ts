import { useQueryClient } from "@tanstack/react-query";

import { sessionFilesKey } from "@/routes/v2/pages/Tangent/hooks/useProjectSessionFiles";
import { sessionRunsKey } from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";

/**
 * Refetches what this page built from a chat's Tangent resources: its files
 * and reports on the project card, and its runs pill. The chat calls it when
 * an agent or another person changes them, so nothing waits for a reload.
 */
export function useRefreshSessionResources(projectId: string) {
  const { baseUrl } = useTangentBaseUrl(projectId);
  const queryClient = useQueryClient();

  return (sessionId: string) => {
    void queryClient.invalidateQueries({
      queryKey: sessionFilesKey(baseUrl, sessionId),
    });
    void queryClient.invalidateQueries({
      queryKey: sessionRunsKey(sessionId),
    });
  };
}
