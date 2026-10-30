import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { ensureSessionTag } from "@/routes/v2/pages/Tangent/services/sessionTags";
import { projectSelector } from "@/services/projects/projectSelector";

interface BackfillSessionTagsParams {
  projectId: string;
  baseUrl: string | null;
  authToken: string | undefined;
  sessionIds: string[];
}

/**
 * Backfills the project's selector tag onto every session that predates session
 * tagging, so a selector-scoped host (a VS Code window bound to the project) can
 * reach them. Runs on mount and whenever the session list changes; a ref of
 * already-ensured ids keeps re-renders from re-reading, and each session is
 * ensured independently so one failure does not stop the rest.
 */
export function useBackfillSessionTags({
  projectId,
  baseUrl,
  authToken,
  sessionIds,
}: BackfillSessionTagsParams): void {
  const queryClient = useQueryClient();
  const ensured = useRef(new Set<string>());

  useEffect(() => {
    if (!baseUrl || !authToken || sessionIds.length === 0) return;

    let cancelled = false;
    const tag = projectSelector(projectId);

    const run = async () => {
      let changed = false;
      for (const sessionId of sessionIds) {
        if (ensured.current.has(sessionId)) continue;
        try {
          const updated = await ensureSessionTag({
            baseUrl,
            sessionId,
            authToken,
            tag,
          });
          ensured.current.add(sessionId);
          if (updated) changed = true;
        } catch (error) {
          console.error(
            `Failed to backfill project tag for session ${sessionId}`,
            error,
          );
        }
      }
      if (changed && !cancelled) {
        void queryClient.invalidateQueries({
          queryKey: ["tangent", "environments", baseUrl],
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [projectId, baseUrl, authToken, sessionIds, queryClient]);
}
