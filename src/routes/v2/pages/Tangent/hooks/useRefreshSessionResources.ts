import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { sessionResourcesKey } from "@/routes/v2/pages/Tangent/services/sessionResources";

const REFRESH_DELAY_MS = 1_000;

/**
 * Refetches what this page built from a chat's Tangent resources: its files
 * and reports on the project card, and its runs pill. The chat calls it when
 * an agent or another person changes them, so nothing waits for a reload.
 *
 * The chat reports a change several times per agent message and each refetch
 * makes Tangent walk the chat's folders, so a burst becomes one refetch once
 * the chat has been quiet for a second.
 */
export function useRefreshSessionResources() {
  const queryClient = useQueryClient();
  const pendingBySession = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  useEffect(() => {
    const pending = pendingBySession.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return (sessionId: string) => {
    const pending = pendingBySession.current;
    clearTimeout(pending.get(sessionId));
    pending.set(
      sessionId,
      setTimeout(() => {
        pending.delete(sessionId);
        void queryClient.invalidateQueries({
          queryKey: sessionResourcesKey(sessionId),
        });
      }, REFRESH_DELAY_MS),
    );
  };
}
