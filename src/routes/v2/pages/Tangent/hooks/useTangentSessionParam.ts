import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { when } from "mobx";
import { useEffect, useRef } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import {
  readTangentSessionParam,
  TANGENT_SESSION_SEARCH_PARAM,
} from "@/routes/tangentSearch";
import { SESSION_RESOURCES } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import {
  everyProjectResourceQueryOptions,
  projectResourcesQueryOptions,
} from "@/services/projects/useProjectResources";

async function projectHasSession(
  client: QueryClient,
  projectId: string,
  sessionId: string,
) {
  const page = await client.fetchQuery({
    ...projectResourcesQueryOptions(projectId, SESSION_RESOURCES),
    staleTime: 0,
  });
  if (page.items.some((row) => row.entityId === sessionId)) return true;
  if (!page.nextPageToken) return false;

  const sessions = await client.fetchQuery({
    ...everyProjectResourceQueryOptions(projectId, ["agent_session"]),
    staleTime: 0,
  });
  return sessions.some((row) => row.entityId === sessionId);
}

/**
 * A shared link must survive a reload, but should stop pointing at the old
 * chat once the user chooses a different one in the same project.
 */
export function useTangentSessionParam(store: TangentProjectStore) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const notify = useToastNotification();
  const queryClient = useQueryClient();
  const previousSessionId = useRef<string>(undefined);

  const asked = readTangentSessionParam(search);
  const sessionId = asked?.kind === "existing" ? asked.sessionId : undefined;

  const newSessionRequested = asked?.kind === "new";

  useEffect(() => {
    const previous = previousSessionId.current;
    previousSessionId.current = sessionId;
    if (!sessionId) {
      // Back removes the link while its chat is still selected. Starting a new
      // chat also removes the link, but has already selected its replacement.
      if (
        !newSessionRequested &&
        previous &&
        store.selectedSessionId === previous
      ) {
        store.selectSession(undefined);
      }
      return;
    }

    store.selectSession(sessionId);

    const stopWatching = when(
      () => store.selectedSessionId !== sessionId,
      () => {
        void navigate({
          to: ".",
          search: (previous: Record<string, unknown>) => {
            const next = { ...previous };
            delete next[TANGENT_SESSION_SEARCH_PARAM];
            return next;
          },
          replace: true,
        } as never);
      },
    );
    let active = true;
    void projectHasSession(queryClient, store.projectId, sessionId).then(
      (found) => {
        if (!found && active && store.selectedSessionId === sessionId) {
          store.selectSession(undefined);
          notify("That chat isn't available in this project.", "warning");
        }
      },
      // A failed request cannot establish that the chat has been removed.
      () => undefined,
    );
    return () => {
      active = false;
      stopWatching();
    };
  }, [sessionId, newSessionRequested, navigate, notify, queryClient, store]);
}
