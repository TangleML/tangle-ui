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
import { useProject } from "@/services/projects/useProjects";

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
  const { data: project } = useProject(projectId);
  const {
    sessions,
    isLoading: isSessionsLoading,
    attachSession,
    detachSession,
  } = useProjectSessions(projectId);
  const [store] = useState(() => new TangentProjectStore(projectId));

  const projectNotes = project?.notes ?? null;
  useEffect(() => {
    store.setSessionIo({
      newSession,
      attachSession,
      detachSession,
      notify,
      projectNotes,
    });
  }, [store, newSession, attachSession, detachSession, notify, projectNotes]);

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
