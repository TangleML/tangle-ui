import { useTangent } from "@tangent/embed-react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { usePrepareProjectArrival } from "@/routes/v2/pages/Tangent/hooks/usePrepareProjectArrival";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { observeWorkareaPipelineDrafts } from "@/routes/v2/pages/Tangent/workarea/observeWorkareaPipelineDrafts";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import { useProjectInstructions } from "@/services/projects/useProjectInstructions";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

const TangentProjectCtx = createRequiredContext<TangentProjectStore>(
  "TangentProjectContext",
);

interface TangentProjectProviderProps {
  projectId: string;
  children: ReactNode;
}

export function TangentProjectProvider({
  projectId,
  children,
}: TangentProjectProviderProps) {
  const notify = useToastNotification();
  const { newSession } = useTangent();
  const { instructions } = useProjectInstructions(projectId);
  const runTeam = useTeamForProjects([projectId]);
  const {
    sessions,
    isLoading: isSessionsLoading,
    attachSession,
    detachSession,
    renameSession,
  } = useProjectSessions(projectId);
  const [store] = useState(() => new TangentProjectStore(projectId));
  const storage = usePipelineStorage();
  const queryClient = useQueryClient();

  useEffect(
    () => observeWorkareaPipelineDrafts(store, storage, queryClient),
    [store, storage, queryClient],
  );

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
      notify,
      projectInstructions: instructions,
      runTeam,
    });
  }, [
    store,
    newSession,
    attachSession,
    detachSession,
    renameSession,
    sessions,
    notify,
    instructions,
    runTeam,
  ]);

  const defaultSessionId = sessions[0]?.sessionId;
  useEffect(() => {
    store.setDefaultSessionId(defaultSessionId);
  }, [store, defaultSessionId]);

  usePrepareProjectArrival(store, {
    projectId,
    sessionCount: sessions.length,
    isSessionsLoading,
    isTeamSettled: runTeam.status !== "resolving",
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
