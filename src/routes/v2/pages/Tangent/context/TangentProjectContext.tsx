import { useTangent } from "@tangent/embed-react";
import { type ReactNode, useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { usePrepareEmptyProject } from "@/routes/v2/pages/Tangent/hooks/usePrepareEmptyProject";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import { useProjectInstructions } from "@/services/projects/useProjectInstructions";

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
  const {
    sessions,
    isLoading: isSessionsLoading,
    attachSession,
    detachSession,
    renameSession,
  } = useProjectSessions(projectId);
  const [store] = useState(() => new TangentProjectStore(projectId));

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
  ]);

  const defaultSessionId = sessions[0]?.sessionId;
  useEffect(() => {
    store.setDefaultSessionId(defaultSessionId);
  }, [store, defaultSessionId]);

  usePrepareEmptyProject(store, {
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
