import { useTangent } from "@tangent/embed-react";
import { useLiveQuery } from "dexie-react-hooks";
import { type ReactNode, useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { TANGENT_BUNDLE_ID } from "@/routes/v2/shared/tangent/constants";
import { useTangentSessionTabs } from "@/routes/v2/shared/tangent/useTangentSessionTabs";
import { tangentDb } from "@/services/tangentStorage/db";
import { setActiveSession } from "@/services/tangentStorage/projects";
import {
  addResource,
  listProjectResources,
  removeResource,
  toHostResourceInput,
} from "@/services/tangentStorage/resources";
import { addSession } from "@/services/tangentStorage/sessions";
import type {
  TangentProject,
  TangentResource,
  TangentResourceInput,
  TangentSession,
} from "@/services/tangentStorage/types";
import { getErrorMessage } from "@/utils/string";

type SessionTabs = ReturnType<typeof useTangentSessionTabs>;

interface TangentProjectContextValue {
  projectId: string;
  project: TangentProject | undefined;
  sessions: TangentSession[];
  activeSessionId: string | undefined;
  isStartingSession: boolean;
  resources: TangentResource[];
  selectSession: (sessionId: string) => void;
  startSession: () => void;
  attachResource: (input: TangentResourceInput) => Promise<void>;
  detachResource: (id: string) => Promise<void>;
  tabs: SessionTabs;
  openArtifact: { url: string; title: string } | null;
  onOpenArtifact: (url: string, title: string) => void;
  closeArtifact: () => void;
  onError: (message: string) => void;
}

const TangentProjectCtx = createRequiredContext<TangentProjectContextValue>(
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
  const {
    newSession,
    addResource: addSessionResource,
    removeResource: removeSessionResource,
  } = useTangent();
  const tabs = useTangentSessionTabs();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [openArtifact, setOpenArtifact] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const project = useLiveQuery(
    () => tangentDb.projects.get(projectId),
    [projectId],
  );
  const sessions =
    useLiveQuery(
      () =>
        tangentDb.sessions
          .where("projectId")
          .equals(projectId)
          .sortBy("createdAt"),
      [projectId],
    ) ?? [];
  const resources =
    useLiveQuery(() => listProjectResources(projectId), [projectId]) ?? [];

  const activeSessionId = project?.activeSessionId;

  const { resetTabs } = tabs;
  useEffect(() => {
    resetTabs();
    setOpenArtifact(null);
  }, [activeSessionId, resetTabs]);

  // Mirror the project's resources into the active session's catalog so the
  // agent sees them as standing context. Re-adding the same `uri` updates in
  // place, so this is safe to run whenever the active session changes.
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const projectResources = await listProjectResources(projectId);
        for (const resource of projectResources) {
          if (cancelled) return;
          await addSessionResource(
            activeSessionId,
            toHostResourceInput(resource),
          );
        }
      } catch (error) {
        if (!cancelled) notify(getErrorMessage(error), "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, projectId, addSessionResource, notify]);

  function selectSession(sessionId: string) {
    void setActiveSession(projectId, sessionId);
  }

  async function startSession() {
    if (isStartingSession) return;
    setIsStartingSession(true);
    try {
      const projectResources = await listProjectResources(projectId);
      const { sessionId } = await newSession(
        "New Tangent session",
        TANGENT_BUNDLE_ID,
        { resources: projectResources.map(toHostResourceInput) },
      );
      await addSession({ sessionId, projectId });
      await setActiveSession(projectId, sessionId);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    } finally {
      setIsStartingSession(false);
    }
  }

  async function attachResource(input: TangentResourceInput) {
    const resource = await addResource(projectId, input);
    if (!activeSessionId) return;
    try {
      await addSessionResource(activeSessionId, toHostResourceInput(resource));
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  async function detachResource(id: string) {
    const resource = resources.find((item) => item.id === id);
    await removeResource(id);
    if (!activeSessionId || !resource) return;
    try {
      await removeSessionResource(activeSessionId, resource.url);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  function onOpenArtifact(url: string, title: string) {
    setOpenArtifact({ url, title });
  }

  function closeArtifact() {
    setOpenArtifact(null);
  }

  function onError(message: string) {
    notify(message, "error");
  }

  const value: TangentProjectContextValue = {
    projectId,
    project,
    sessions,
    activeSessionId,
    isStartingSession,
    resources,
    selectSession,
    startSession,
    attachResource,
    detachResource,
    tabs,
    openArtifact,
    onOpenArtifact,
    closeArtifact,
    onError,
  };

  return (
    <TangentProjectCtx.Provider value={value}>
      {children}
    </TangentProjectCtx.Provider>
  );
}

export function useTangentProject(): TangentProjectContextValue {
  return useRequiredContext(TangentProjectCtx);
}
