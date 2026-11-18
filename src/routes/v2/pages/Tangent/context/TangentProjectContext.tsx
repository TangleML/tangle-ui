import { useTangent } from "@tangent/embed-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { userQueryOptions } from "@/hooks/useUserDetails";
import { readTangentSessionParam } from "@/routes/tangentSearch";
import { useBackfillSessionTags } from "@/routes/v2/pages/Tangent/hooks/useBackfillSessionTags";
import { useBuiltFor } from "@/routes/v2/pages/Tangent/hooks/useBuiltFor";
import { usePrepareProjectArrival } from "@/routes/v2/pages/Tangent/hooks/usePrepareProjectArrival";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useProjectSharedFolder } from "@/routes/v2/pages/Tangent/hooks/useProjectSharedFolder";
import { useRememberOpenTabs } from "@/routes/v2/pages/Tangent/hooks/useRememberOpenTabs";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useRecordSessionRun } from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { observeWorkareaPipelineDrafts } from "@/routes/v2/pages/Tangent/workarea/observeWorkareaPipelineDrafts";
import { readOpenTabs } from "@/routes/v2/pages/Tangent/workarea/openTabsStorage";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import { useProjectInstructions } from "@/services/projects/useProjectInstructions";

const TangentProjectCtx = createRequiredContext<TangentProjectStore>(
  "TangentProjectContext",
);

interface TangentProjectProviderProps {
  projectId: string;
  children: ReactNode;
}

/**
 * A project gets its own store, but moving between projects swaps the store
 * rather than remounting the page, so the shell stays put and only the content
 * changes. The fresh store starts on the session it is headed for, which keeps
 * the chat from flashing "No active session" while effects catch up, and with
 * the tabs this person had open in the project last time, when it's already
 * known who they are.
 */
function useProjectStore(
  projectId: string,
  seed: {
    defaultSessionId?: string;
    askedSessionId?: string;
    userId?: string;
    tangentBaseUrl: string | null;
  },
): TangentProjectStore {
  const create = () => {
    const { userId, tangentBaseUrl } = seed;
    const store = new TangentProjectStore(
      projectId,
      userId !== undefined && tangentBaseUrl
        ? readOpenTabs({ userId, projectId }, tangentBaseUrl)
        : undefined,
    );
    store.setTangentBaseUrl(tangentBaseUrl);
    store.setDefaultSessionId(seed.defaultSessionId);
    if (seed.askedSessionId) store.selectSession(seed.askedSessionId);
    return store;
  };
  return useBuiltFor(projectId, create);
}

export function TangentProjectProvider({
  projectId,
  children,
}: TangentProjectProviderProps) {
  const notify = useToastNotification();
  const { newSession } = useTangent();
  const { instructions } = useProjectInstructions(projectId);
  const {
    sessions,
    isLoading: isSessionsLoading,
    attachSession,
    detachSession,
    renameSession,
  } = useProjectSessions(projectId);
  const ensureSharedFolderId = useProjectSharedFolder(projectId);
  const asked = readTangentSessionParam(useSearch({ strict: false }));
  const { baseUrl } = useTangentBaseUrl(projectId);
  const queryClient = useQueryClient();
  const store = useProjectStore(projectId, {
    defaultSessionId: sessions[0]?.sessionId,
    askedSessionId: asked?.kind === "existing" ? asked.sessionId : undefined,
    userId: queryClient.getQueryData(userQueryOptions.queryKey)?.id,
    tangentBaseUrl: baseUrl,
  });
  const storage = usePipelineStorage();
  const recordSessionRun = useRecordSessionRun();

  useEffect(
    () => observeWorkareaPipelineDrafts(store, storage, queryClient),
    [store, storage, queryClient],
  );
  useRememberOpenTabs(store, baseUrl);

  useEffect(() => {
    store.setSessionIo({
      newSession,
      attachSession,
      detachSession,
      nameSessionIfUnnamed: async (sessionId, prompt) => {
        const session = sessions.find((one) => one.sessionId === sessionId);
        const name = nameFromPrompt(prompt);
        if (!session || session.name || !name) return;
        await renameSession(session.resourceId, name);
      },
      ensureSharedFolderId,
      notify,
      projectInstructions: instructions,
      recordSessionRun,
    });
  }, [
    store,
    newSession,
    attachSession,
    detachSession,
    renameSession,
    sessions,
    ensureSharedFolderId,
    notify,
    instructions,
    recordSessionRun,
  ]);

  const defaultSessionId = sessions[0]?.sessionId;
  useEffect(() => {
    store.setDefaultSessionId(defaultSessionId);
  }, [store, defaultSessionId]);

  const authToken = useRemoteEnvAuthToken();
  useBackfillSessionTags({
    projectId,
    baseUrl,
    authToken,
    sessionIds: sessions.map((session) => session.sessionId),
  });

  usePrepareProjectArrival(store, {
    projectId,
    sessionCount: sessions.length,
    isSessionsLoading,
  });

  useEffect(
    () => () => {
      void store.discardActiveSessionOnUnmount();
    },
    [store],
  );

  return (
    <TangentProjectCtx.Provider value={store}>
      {children}
    </TangentProjectCtx.Provider>
  );
}

export function useTangentProject(): TangentProjectStore {
  return useRequiredContext(TangentProjectCtx);
}
