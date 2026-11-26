import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { reaction, when } from "mobx";
import { useEffect, useRef } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import {
  readTangentSessionParam,
  withoutTangentMessageSearch,
  withoutTangentSessionSearch,
} from "@/routes/tangentSearch";
import { SESSION_RESOURCES } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import {
  CHAT_TAB_VALUE,
  type TangentProjectStore,
} from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
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
  const message = asked?.kind === "existing" ? asked.message : undefined;
  const messageId = message?.messageId;
  const agentId = message?.agentId;

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
          search: withoutTangentSessionSearch,
          replace: true,
        });
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

  useEffect(() => {
    if (!sessionId || !messageId) return;
    const tab = agentId ?? CHAT_TAB_VALUE;
    if (!agentId || store.chatTabs.some(({ id }) => id === agentId)) {
      store.setChatActiveTab(tab);
    }
    // An unopened agent tab is selected by the embed after its roster arrives.
    return reaction(
      () => store.chatActiveTab,
      (activeTab) => {
        if (activeTab === tab || store.activeSessionId !== sessionId) return;
        void navigate({
          to: ".",
          search: withoutTangentMessageSearch,
          replace: true,
        });
      },
    );
  }, [sessionId, messageId, agentId, navigate, store]);

  return store.activeSessionId === sessionId ? message : undefined;
}
