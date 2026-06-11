import { useQuery } from "@tanstack/react-query";

import {
  deriveResearchProgress,
  fetchSessionMessages,
  fetchSessionStatus,
  fetchSessionTodos,
  isResearchPhaseTerminal,
  type ResearchProgress,
} from "@/routes/tangent/services/autoresearchOpencode";
import { TangentQueryKeys } from "@/routes/tangent/types";

const POLL_INTERVAL_MS = 4000;

interface ResearchRef {
  instanceId: string;
  sessionId: string;
}

/**
 * Polls the OpenCode session backing a scenario's automated research and
 * derives a progress snapshot. Polling stops once the agent reaches a terminal
 * phase (completed or failed); the query is disabled when no research exists.
 */
export function useResearchProgress(research?: ResearchRef) {
  return useQuery<ResearchProgress>({
    queryKey: TangentQueryKeys.Research(
      research?.instanceId ?? "",
      research?.sessionId ?? "",
    ),
    enabled: Boolean(research),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      if (phase && isResearchPhaseTerminal(phase)) return false;
      return POLL_INTERVAL_MS;
    },
    queryFn: async () => {
      if (!research) {
        throw new Error("useResearchProgress queried without a research ref");
      }
      const { instanceId, sessionId } = research;
      const [statusType, messages, todos] = await Promise.all([
        fetchSessionStatus(instanceId, sessionId),
        fetchSessionMessages(instanceId, sessionId),
        fetchSessionTodos(instanceId, sessionId),
      ]);
      return deriveResearchProgress(statusType, messages, todos);
    },
  });
}
