import { useTangent } from "@tangent/embed-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
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
  WorkareaTarget,
  WorkareaViewKindName,
} from "@/routes/v2/pages/Tangent/workarea/types";
import {
  formatWorkareaTarget,
  idIdentity,
  sameTarget,
} from "@/routes/v2/pages/Tangent/workarea/workareaTarget";
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

interface TabBridgeRegistration {
  kind: "pipeline" | "run";
  bridge: ToolBridgeApi;
}

export type ProjectResourceKind = "pipeline";

export interface ProjectResourceItem {
  id: string;
  name: string;
  entity: ProjectResourceKind;
  target: WorkareaTarget;
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
  getWorkareaTabs: () => WorkareaTab[];
  getActiveWorkareaTabId: () => string | undefined;
  openWorkareaTarget: (
    target: WorkareaTarget,
    title?: string,
  ) => Promise<WorkareaTab>;
  selectWorkareaTab: (id: string) => void;
  closeWorkareaTab: (id: string) => void;
  registerWorkareaTabStore: (tabId: string, store: SharedUIStore) => void;
  unregisterWorkareaTabStore: (tabId: string) => void;
  registerTabEnvironment: (tabId: string, environmentId: string) => void;
  unregisterTabEnvironment: (tabId: string) => void;
  getTabEnvironmentId: (tabId: string) => string | undefined;
  waitForTabEnvironment: (
    tabId: string,
    timeoutMs?: number,
  ) => Promise<string | undefined>;
  registerTabBridge: (
    tabId: string,
    kind: "pipeline" | "run",
    bridge: ToolBridgeApi,
  ) => void;
  unregisterTabBridge: (tabId: string) => void;
  getActiveTabBridge: () => ToolBridgeApi | undefined;
  onOpenArtifact: (url: string, title: string) => void;
  onError: (message: string) => void;
}

/** How long {@link TangentProjectContextValue.waitForTabEnvironment} waits. */
const DEFAULT_ENVIRONMENT_WAIT_MS = 15_000;

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
  const [selectedSessionId, setSelectedSessionId] = useState<
    string | undefined
  >();
  // The selected session wins while it exists; otherwise fall back to the most
  // recent attached session (the list is newest-first).
  const activeSessionId = selectedSessionId ?? sessions[0]?.sessionId;
  const tabs = useTangentSessionTabs(activeSessionId);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [workareaTabs, setWorkareaTabs] = useState<WorkareaTab[]>([]);
  const [activeWorkareaTabId, setActiveWorkareaTabId] = useState<string | null>(
    null,
  );
  const workareaTabsRef = useRef<WorkareaTab[]>([]);
  const activeWorkareaTabIdRef = useRef<string | null>(null);

  // Workarea tabs are per-session (PR 9): switching sessions restores the
  // incoming session's tabs instead of resetting. These maps are the
  // per-session source of truth; the state/refs above mirror the active one.
  const workareaTabsBySessionRef = useRef(new Map<string, WorkareaTab[]>());
  const workareaActiveBySessionRef = useRef(new Map<string, string | null>());

  // Each embeddable workarea tab (pipeline today, run later) surfaces its live
  // SharedUIStore here on mount and drops it on unmount, so chat chips (PR 10)
  // can focus an entity on the right tab's canvas.
  const workareaTabStoresRef = useRef(new Map<string, SharedUIStore>());

  // Each spawnable tab's agent connects its own remote-env environment; we
  // track tabId -> environmentId (plus pending waiters) in refs so the workarea
  // tools can resolve a spawn target without triggering re-renders.
  const tabEnvironmentsRef = useRef(new Map<string, string>());
  const tabEnvironmentWaitersRef = useRef(
    new Map<string, Set<(environmentId: string | undefined) => void>>(),
  );
  // Each spawnable tab publishes its live ToolBridgeApi here so the project-level
  // editor agent can drive whichever pipeline is active. `activeWorkareaTabId`
  // is mirrored to a ref because `getActiveTabBridge` is read from the worker
  // (via a stable routing bridge) outside React's render cycle.
  const tabBridgesRef = useRef(new Map<string, TabBridgeRegistration>());
  const activeWorkareaTabTypeRef = useRef<WorkareaViewKindName | null>(null);
  const lastEditorTabIdRef = useRef<string | null>(null);

  // Sessions started this mount, mapped to their resource id, so a never-used
  // one can be detached + deleted on switch/unmount. Only sessions started here
  // are eligible — pre-existing attached sessions are never auto-discarded.
  const freshSessionsRef = useRef(new Map<string, string>());
  const sessionsWithPromptRef = useRef(new Set<string>());
  const activeSessionIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Derive the out-of-render tab refs from a tab set and its active id. The
  // editor-bridge fallback keeps the active pipeline tab when one is focused,
  // otherwise the still-open last editor tab, otherwise the newest pipeline.
  function syncActiveTabRefs(tabs: WorkareaTab[], activeId: string | null) {
    activeWorkareaTabIdRef.current = activeId;
    const activeTab = tabs.find((tab) => tab.id === activeId);
    activeWorkareaTabTypeRef.current = activeTab?.target.type ?? null;
    if (activeTab?.target.type === "pipeline") {
      lastEditorTabIdRef.current = activeTab.id;
      return;
    }
    if (tabs.some((tab) => tab.id === lastEditorTabIdRef.current)) return;
    const lastPipelineTab = [...tabs]
      .reverse()
      .find((tab) => tab.target.type === "pipeline");
    lastEditorTabIdRef.current = lastPipelineTab?.id ?? null;
  }

  useEffect(() => {
    syncActiveTabRefs(workareaTabs, activeWorkareaTabId);
  }, [activeWorkareaTabId, workareaTabs]);

  // Restore the incoming session's workarea tabs on switch (PR 9). Backgrounded
  // sessions' tabs unmount, so their env/bridge/store registrations clean up on
  // their own; here we only swap the visible active-session mirror.
  useEffect(() => {
    const restoredTabs = activeSessionId
      ? (workareaTabsBySessionRef.current.get(activeSessionId) ?? [])
      : [];
    const restoredActiveId = activeSessionId
      ? (workareaActiveBySessionRef.current.get(activeSessionId) ?? null)
      : null;
    workareaTabsRef.current = restoredTabs;
    setWorkareaTabs(restoredTabs);
    setActiveWorkareaTabId(restoredActiveId);
    syncActiveTabRefs(restoredTabs, restoredActiveId);
  }, [activeSessionId]);

  async function discardEmptySession(sessionId: string | undefined) {
    if (!sessionId) return;
    const resourceId = freshSessionsRef.current.get(sessionId);
    if (!resourceId) return;
    if (sessionsWithPromptRef.current.has(sessionId)) return;
    freshSessionsRef.current.delete(sessionId);
    workareaTabsBySessionRef.current.delete(sessionId);
    workareaActiveBySessionRef.current.delete(sessionId);
    tabs.dropSession(sessionId);
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
    return workareaTabsRef.current.find((tab) =>
      sameTarget(tab.target, view.target),
    );
  }

  // Persist the active session's tabs and mirror them to the state/refs the
  // shell and the out-of-render tool reads consume.
  function setSessionTabs(sessionTabs: WorkareaTab[]) {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    workareaTabsBySessionRef.current.set(sessionId, sessionTabs);
    workareaTabsRef.current = sessionTabs;
    setWorkareaTabs(sessionTabs);
  }

  function setSessionActiveTabId(id: string | null) {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    workareaActiveBySessionRef.current.set(sessionId, id);
    activeWorkareaTabIdRef.current = id;
    setActiveWorkareaTabId(id);
  }

  function activateWorkareaTab(tab: WorkareaTab | undefined) {
    activeWorkareaTabTypeRef.current = tab?.target.type ?? null;
    if (tab?.target.type === "pipeline") {
      lastEditorTabIdRef.current = tab.id;
    }
    setSessionActiveTabId(tab?.id ?? null);
  }

  function openResolvedView(view: ResolvedWorkareaView): WorkareaTab {
    const existing = findExistingTab(view);
    if (existing) {
      activateWorkareaTab(existing);
      return existing;
    }
    const tab: WorkareaTab = { ...view, id: crypto.randomUUID() };
    const nextTabs = [...workareaTabsRef.current, tab];
    setSessionTabs(nextTabs);
    activateWorkareaTab(tab);
    return tab;
  }

  function openArtifactTab(url: string, title: string): WorkareaTab {
    return openResolvedView({
      title,
      target: { type: "artifact", identity: idIdentity(url) },
    });
  }

  // Target entry point for opening the workarea from the resources dock, chat,
  // or agents. Resolves the target's title and routes it through the registry.
  async function openWorkareaTarget(
    target: WorkareaTarget,
    title?: string,
  ): Promise<WorkareaTab> {
    const view = await resolveWorkareaTarget(target, { title });
    return openResolvedView(view);
  }

  function selectWorkareaTab(id: string) {
    const tab = workareaTabsRef.current.find(
      (candidate) => candidate.id === id,
    );
    if (!tab) return;
    activateWorkareaTab(tab);
  }

  function closeWorkareaTab(id: string) {
    unregisterTabEnvironment(id);
    unregisterTabBridge(id);
    if (lastEditorTabIdRef.current === id) {
      lastEditorTabIdRef.current = null;
    }
    const next = workareaTabsRef.current.filter((tab) => tab.id !== id);
    setSessionTabs(next);
    if (activeWorkareaTabIdRef.current === id) {
      activateWorkareaTab(next.at(-1));
    }
  }

  function getWorkareaTabs(): WorkareaTab[] {
    return workareaTabsRef.current;
  }

  function getActiveWorkareaTabId(): string | undefined {
    return activeWorkareaTabIdRef.current ?? undefined;
  }

  function registerWorkareaTabStore(tabId: string, store: SharedUIStore) {
    workareaTabStoresRef.current.set(tabId, store);
  }

  function unregisterWorkareaTabStore(tabId: string) {
    workareaTabStoresRef.current.delete(tabId);
  }

  function registerTabEnvironment(tabId: string, environmentId: string) {
    tabEnvironmentsRef.current.set(tabId, environmentId);
    const waiters = tabEnvironmentWaitersRef.current.get(tabId);
    if (!waiters) return;
    tabEnvironmentWaitersRef.current.delete(tabId);
    for (const resolve of waiters) resolve(environmentId);
  }

  function unregisterTabEnvironment(tabId: string) {
    tabEnvironmentsRef.current.delete(tabId);
    const waiters = tabEnvironmentWaitersRef.current.get(tabId);
    if (!waiters) return;
    tabEnvironmentWaitersRef.current.delete(tabId);
    for (const resolve of waiters) resolve(undefined);
  }

  function getTabEnvironmentId(tabId: string): string | undefined {
    return tabEnvironmentsRef.current.get(tabId);
  }

  function waitForTabEnvironment(
    tabId: string,
    timeoutMs: number = DEFAULT_ENVIRONMENT_WAIT_MS,
  ): Promise<string | undefined> {
    const existing = tabEnvironmentsRef.current.get(tabId);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const waiters =
        tabEnvironmentWaitersRef.current.get(tabId) ??
        new Set<(environmentId: string | undefined) => void>();
      tabEnvironmentWaitersRef.current.set(tabId, waiters);
      const onReady = (environmentId: string | undefined) => {
        clearTimeout(timer);
        resolve(environmentId);
      };
      const timer = setTimeout(() => {
        waiters.delete(onReady);
        resolve(undefined);
      }, timeoutMs);
      waiters.add(onReady);
    });
  }

  function registerTabBridge(
    tabId: string,
    kind: "pipeline" | "run",
    bridge: ToolBridgeApi,
  ) {
    tabBridgesRef.current.set(tabId, { kind, bridge });
  }

  function unregisterTabBridge(tabId: string) {
    tabBridgesRef.current.delete(tabId);
  }

  function getActiveTabBridge(): ToolBridgeApi | undefined {
    if (activeWorkareaTabTypeRef.current === "run") return undefined;
    const activeId = activeWorkareaTabIdRef.current;
    const activeRegistration = activeId
      ? tabBridgesRef.current.get(activeId)
      : undefined;
    if (activeRegistration?.kind === "pipeline") {
      return activeRegistration.bridge;
    }
    const fallbackId = lastEditorTabIdRef.current;
    const fallbackRegistration = fallbackId
      ? tabBridgesRef.current.get(fallbackId)
      : undefined;
    return fallbackRegistration?.kind === "pipeline"
      ? fallbackRegistration.bridge
      : undefined;
  }

  const resources: ProjectResourceItem[] = (resourcesPage?.items ?? []).flatMap(
    (resource) => {
      if (resource.entity !== "pipeline") return [];
      if (!resource.entityId) return [];
      const target: WorkareaTarget = {
        type: "pipeline",
        identity: idIdentity(resource.entityId),
      };
      return [
        {
          id: resource.id,
          name: resource.name ?? formatWorkareaTarget(target),
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
    getWorkareaTabs,
    getActiveWorkareaTabId,
    openWorkareaTarget,
    selectWorkareaTab,
    closeWorkareaTab,
    registerWorkareaTabStore,
    unregisterWorkareaTabStore,
    registerTabEnvironment,
    unregisterTabEnvironment,
    getTabEnvironmentId,
    waitForTabEnvironment,
    registerTabBridge,
    unregisterTabBridge,
    getActiveTabBridge,
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
