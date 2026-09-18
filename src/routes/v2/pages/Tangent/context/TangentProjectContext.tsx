import { useTangent } from "@tangent/embed-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { TANGENT_BUNDLE_ID } from "@/routes/v2/pages/Tangent/constants";
import {
  type ProjectSession,
  useProjectSessions,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useTangentSessionTabs } from "@/routes/v2/pages/Tangent/hooks/useTangentSessionTabs";
import { resolveWorkareaTarget } from "@/routes/v2/pages/Tangent/services/resolveWorkareaTarget";
import type {
  ResolvedWorkareaView,
  WorkareaTab,
} from "@/routes/v2/pages/Tangent/workarea/types";
import type { SharedUIStore } from "@/routes/v2/shared/store/SharedStoreContext";
import type { Project } from "@/services/projects/types";
import {
  useCreateProjectResource,
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { useProject, useUpdateProject } from "@/services/projects/useProjects";
import { getErrorMessage } from "@/utils/string";

type SessionTabs = ReturnType<typeof useTangentSessionTabs>;

export type ProjectResourceKind = "pipeline";

export interface ProjectResourceItem {
  id: string;
  name: string;
  entity: ProjectResourceKind;
  target: string;
}

export interface AttachResourceInput {
  entity: ProjectResourceKind;
  entityId: string;
  name: string;
}

interface TangentProjectContextValue {
  projectId: string;
  project: Project | undefined;
  sessions: ProjectSession[];
  activeSessionId: string | undefined;
  isStartingSession: boolean;
  selectSession: (sessionId: string) => void;
  startSession: () => void;
  recordSessionPrompt: (content: string) => void;
  tabs: SessionTabs;
  resources: ProjectResourceItem[];
  attachResource: (input: AttachResourceInput) => void;
  isAttachingResource: boolean;
  detachResource: (resourceId: string) => void;
  isDetachingResource: boolean;
  instructions: string;
  setInstructions: (text: string) => void;
  isSavingInstructions: boolean;
  workareaTabs: WorkareaTab[];
  activeWorkareaTabId: string | null;
  openWorkareaTarget: (target: string, title?: string) => Promise<WorkareaTab>;
  selectWorkareaTab: (id: string) => void;
  closeWorkareaTab: (id: string) => void;
  registerWorkareaTabStore: (tabId: string, store: SharedUIStore) => void;
  unregisterWorkareaTabStore: (tabId: string) => void;
  onOpenArtifact: (url: string, title: string) => void;
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
  const { newSession } = useTangent();
  const { data: project } = useProject(projectId);
  const { sessions, attachSession, detachSession } =
    useProjectSessions(projectId);
  const { data: resourcesPage } = useProjectResources(projectId);
  const { mutate: createResource, isPending: isAttachingResource } =
    useCreateProjectResource(projectId);
  const { mutate: deleteResource, isPending: isDetachingResource } =
    useDeleteProjectResource(projectId);
  const { mutate: updateProject, isPending: isSavingInstructions } =
    useUpdateProject();
  const tabs = useTangentSessionTabs();
  const [selectedSessionId, setSelectedSessionId] = useState<
    string | undefined
  >();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [workareaTabs, setWorkareaTabs] = useState<WorkareaTab[]>([]);
  const [activeWorkareaTabId, setActiveWorkareaTabId] = useState<string | null>(
    null,
  );

  // Each embeddable workarea tab (pipeline today, run later) surfaces its live
  // SharedUIStore here on mount and drops it on unmount, so chat chips (PR 10)
  // can focus an entity on the right tab's canvas.
  const workareaTabStoresRef = useRef(new Map<string, SharedUIStore>());

  // The selected session wins while it exists; otherwise fall back to the most
  // recent attached session (the list is newest-first).
  const activeSessionId = selectedSessionId ?? sessions[0]?.sessionId;

  // Sessions started this mount, mapped to their resource id, so a never-used
  // one can be detached + deleted on switch/unmount. Only sessions started here
  // are eligible — pre-existing attached sessions are never auto-discarded.
  const freshSessionsRef = useRef(new Map<string, string>());
  const sessionsWithPromptRef = useRef(new Set<string>());
  const activeSessionIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const { resetTabs } = tabs;
  useEffect(() => {
    resetTabs();
    setWorkareaTabs([]);
    setActiveWorkareaTabId(null);
  }, [activeSessionId, resetTabs]);

  async function discardEmptySession(sessionId: string | undefined) {
    if (!sessionId) return;
    const resourceId = freshSessionsRef.current.get(sessionId);
    if (!resourceId) return;
    if (sessionsWithPromptRef.current.has(sessionId)) return;
    freshSessionsRef.current.delete(sessionId);
    try {
      await detachSession(resourceId);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  // Keep a ref to the latest `discardEmptySession` so the unmount-only cleanup
  // (empty deps) runs current logic without re-subscribing every render.
  const discardEmptySessionRef = useRef(discardEmptySession);
  useEffect(() => {
    discardEmptySessionRef.current = discardEmptySession;
  });
  useEffect(
    () => () => {
      void discardEmptySessionRef.current(activeSessionIdRef.current);
    },
    [],
  );

  async function startSession() {
    if (isStartingSession) return;
    const previous = activeSessionIdRef.current;
    setIsStartingSession(true);
    try {
      // Empty prompt: the embed skips the opening turn so the human types the
      // first message. `name` labels the session in Tangent's own session list.
      const { sessionId } = await newSession("", TANGENT_BUNDLE_ID, {
        name: "New Tangent session",
      });
      const resource = await attachSession(sessionId);
      freshSessionsRef.current.set(sessionId, resource.id);
      setSelectedSessionId(sessionId);
      if (previous && previous !== sessionId) {
        await discardEmptySession(previous);
      }
    } catch (error) {
      notify(getErrorMessage(error), "error");
    } finally {
      setIsStartingSession(false);
    }
  }

  function selectSession(sessionId: string) {
    const previous = activeSessionIdRef.current;
    setSelectedSessionId(sessionId);
    if (previous && previous !== sessionId) {
      void discardEmptySession(previous);
    }
  }

  function recordSessionPrompt(content: string) {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    if (!content.trim()) return;
    sessionsWithPromptRef.current.add(sessionId);
  }

  function findExistingTab(
    view: ResolvedWorkareaView,
  ): WorkareaTab | undefined {
    return workareaTabs.find((tab) => {
      if (tab.kind !== view.kind) return false;
      if (tab.kind === "artifact" && view.kind === "artifact") {
        return tab.url === view.url;
      }
      if (tab.kind === "pipeline" && view.kind === "pipeline") {
        return tab.pipelineRef.fileId
          ? tab.pipelineRef.fileId === view.pipelineRef.fileId
          : tab.title === view.title;
      }
      if (tab.kind === "run" && view.kind === "run") {
        return tab.runId === view.runId;
      }
      return false;
    });
  }

  function openResolvedView(view: ResolvedWorkareaView): WorkareaTab {
    const existing = findExistingTab(view);
    if (existing) {
      setActiveWorkareaTabId(existing.id);
      return existing;
    }
    const tab: WorkareaTab = { ...view, id: crypto.randomUUID() };
    setWorkareaTabs((prev) => [...prev, tab]);
    setActiveWorkareaTabId(tab.id);
    return tab;
  }

  function openArtifactTab(url: string, title: string): WorkareaTab {
    return openResolvedView({ kind: "artifact", title, url });
  }

  // String-target entry point (`pipeline://`, run refs, artifact URLs, …) for
  // opening the workarea from the resources dock, chat, or agents. Resolves the
  // target to a concrete view and routes it through the workarea registry.
  async function openWorkareaTarget(
    target: string,
    title?: string,
  ): Promise<WorkareaTab> {
    const view = await resolveWorkareaTarget(target, { title });
    return openResolvedView(view);
  }

  function selectWorkareaTab(id: string) {
    setActiveWorkareaTabId(id);
  }

  function closeWorkareaTab(id: string) {
    const next = workareaTabs.filter((tab) => tab.id !== id);
    setWorkareaTabs(next);
    if (activeWorkareaTabId === id) {
      setActiveWorkareaTabId(next.length > 0 ? next[next.length - 1].id : null);
    }
  }

  function registerWorkareaTabStore(tabId: string, store: SharedUIStore) {
    workareaTabStoresRef.current.set(tabId, store);
  }

  function unregisterWorkareaTabStore(tabId: string) {
    workareaTabStoresRef.current.delete(tabId);
  }

  const resources: ProjectResourceItem[] = (resourcesPage?.items ?? []).flatMap(
    (resource) => {
      if (resource.entity !== "pipeline") return [];
      if (!resource.entityId) return [];
      const target = `pipeline://${resource.entityId}`;
      return [
        {
          id: resource.id,
          name: resource.name ?? target,
          entity: resource.entity,
          target,
        },
      ];
    },
  );

  function attachResource(input: AttachResourceInput) {
    createResource({
      entity: input.entity,
      entityId: input.entityId,
      name: input.name,
    });
  }

  function detachResource(resourceId: string) {
    deleteResource(resourceId);
  }

  const instructions = project?.notes ?? "";

  function setInstructions(text: string) {
    updateProject({ id: projectId, input: { notes: text } });
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
    selectSession,
    startSession,
    recordSessionPrompt,
    tabs,
    resources,
    attachResource,
    isAttachingResource,
    detachResource,
    isDetachingResource,
    instructions,
    setInstructions,
    isSavingInstructions,
    workareaTabs,
    activeWorkareaTabId,
    openWorkareaTarget,
    selectWorkareaTab,
    closeWorkareaTab,
    registerWorkareaTabStore,
    unregisterWorkareaTabStore,
    onOpenArtifact: openArtifactTab,
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
