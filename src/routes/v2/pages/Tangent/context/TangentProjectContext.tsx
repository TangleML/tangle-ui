import { useTangent } from "@tangent/embed-react";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { useProject, useUpdateProject } from "@/services/projects/useProjects";

const TangentProjectCtx = createRequiredContext<TangentProjectStore>(
  "TangentProjectContext",
);

function readStartingPrompt(
  extraData: Record<string, unknown> | null | undefined,
): string | undefined {
  const value = extraData?.startingPrompt;
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function useStartSessionWithPrompt(
  store: TangentProjectStore,
  {
    projectId,
    sessionCount,
    isSessionsLoading,
  }: {
    projectId: string;
    sessionCount: number;
    isSessionsLoading: boolean;
  },
) {
  const { data: project } = useProject(projectId);
  const { mutateAsync: updateProject } = useUpdateProject();
  const startingPrompt = readStartingPrompt(project?.extraData);

  const { mutate, isIdle } = useMutation({
    mutationFn: async (prompt: string) => {
      const started = await store.startSession({
        prompt,
        name: "Debug session",
      });
      if (!started) return;
      const nextExtraData = { ...(project?.extraData ?? {}) };
      delete nextExtraData.startingPrompt;
      await updateProject({
        id: projectId,
        input: { extraData: nextExtraData },
      });
    },
  });

  const shouldStart =
    isIdle &&
    !isSessionsLoading &&
    !store.isStartingSession &&
    Boolean(startingPrompt) &&
    sessionCount === 0;

  useEffect(() => {
    if (!shouldStart || !startingPrompt) return;
    mutate(startingPrompt);
  }, [shouldStart, startingPrompt]);
}

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

  useStartSessionWithPrompt(store, {
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
