import { useLiveQuery } from "dexie-react-hooks";
import { when } from "mobx";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import {
  type ResolvedWorkareaView,
  resolveWorkareaTarget,
} from "@/routes/v2/pages/Tangent/services/openWorkareaTarget";
import { resolveChatEntity } from "@/routes/v2/shared/components/AiChat/components/resolveChatEntity";
import { navigateToEntity } from "@/routes/v2/shared/store/focus.actions";
import type { SharedUIStore } from "@/routes/v2/shared/store/SharedStoreContext";
import { TANGENT_BUNDLE_ID } from "@/routes/v2/shared/tangent/constants";
import { useTangent } from "@/routes/v2/shared/tangent/TangentEmbedProvider";
import { useTangentSessionTabs } from "@/routes/v2/shared/tangent/useTangentSessionTabs";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import { tangentDb } from "@/services/tangentStorage/db";
import {
  setActiveSession,
  setProjectMemory,
} from "@/services/tangentStorage/projects";
import {
  addResource,
  listProjectResources,
  removeResource,
  toHostResourceInput,
  toMemoryResourceInput,
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

/** An open view in the Dynamic Workarea. The `id` is the stable tab key. */
export type WorkareaTab = ResolvedWorkareaView & { id: string };

interface TangentProjectContextValue {
  projectId: string;
  project: TangentProject | undefined;
  sessions: TangentSession[];
  activeSessionId: string | undefined;
  isStartingSession: boolean;
  resources: TangentResource[];
  memory: string;
  selectSession: (sessionId: string) => void;
  startSession: () => void;
  setMemory: (content: string) => Promise<void>;
  attachResource: (input: TangentResourceInput) => Promise<void>;
  detachResource: (id: string) => Promise<void>;
  tabs: SessionTabs;
  workareaTabs: WorkareaTab[];
  activeWorkareaTabId: string | null;
  openArtifactTab: (url: string, title: string) => WorkareaTab;
  openPipelineTab: (pipelineRef: PipelineRef, title: string) => WorkareaTab;
  openWorkareaTarget: (target: string, title?: string) => Promise<WorkareaTab>;
  selectWorkareaTab: (id: string) => void;
  closeWorkareaTab: (id: string) => void;
  /**
   * Record the remote-env `environmentId` a pipeline tab's editor agent
   * connected with, so the workarea tools can hand it to Prime for spawns.
   */
  registerTabEnvironment: (tabId: string, environmentId: string) => void;
  /** Forget a tab's environment (on disconnect or tab close). */
  unregisterTabEnvironment: (tabId: string) => void;
  /** The environmentId a tab's editor agent is connected with, if any. */
  getTabEnvironmentId: (tabId: string) => string | undefined;
  /**
   * Resolve once the tab's editor agent has connected an environment, or with
   * `undefined` if it does not within `timeoutMs`.
   */
  waitForTabEnvironment: (
    tabId: string,
    timeoutMs?: number,
  ) => Promise<string | undefined>;
  /**
   * Publish a pipeline tab's live `ToolBridgeApi` so the project-level editor
   * agent (spawns not bound to a specific tab) can drive the active pipeline.
   */
  registerTabBridge: (tabId: string, bridge: ToolBridgeApi) => void;
  /** Forget a tab's bridge (on disconnect or tab close). */
  unregisterTabBridge: (tabId: string) => void;
  /** The bridge of the active pipeline tab, if the active tab is a pipeline. */
  getActiveTabBridge: () => ToolBridgeApi | undefined;
  /** Publish a pipeline tab's live shared store so chat chips can focus it. */
  registerTabStore: (tabId: string, store: SharedUIStore) => void;
  /** Forget a tab's shared store (on tab close/unmount). */
  unregisterTabStore: (tabId: string) => void;
  /**
   * Resolve once the tab's shared store has been published, or with `undefined`
   * if it does not within `timeoutMs`.
   */
  waitForTabStore: (
    tabId: string,
    timeoutMs?: number,
  ) => Promise<SharedUIStore | undefined>;
  /** The shared store of the active pipeline tab, if the active tab is one. */
  activeTabStore: SharedUIStore | undefined;
  /**
   * Reveal an `entity://` chip target: focus it in whichever open pipeline tab
   * contains it, or open the project's last pipeline and navigate once loaded.
   * Resolves `true` when the entity was navigated to.
   */
  revealEntity: (entityId: string, label: string) => Promise<boolean>;
  /** Alias for {@link openArtifactTab}; kept for the embed chat artifact links. */
  onOpenArtifact: (url: string, title: string) => void;
  onError: (message: string) => void;
}

/** How long {@link TangentProjectContextValue.waitForTabEnvironment} waits. */
const DEFAULT_ENVIRONMENT_WAIT_MS = 15_000;

/** How long {@link TangentProjectContextValue.waitForTabStore} waits. */
const DEFAULT_STORE_WAIT_MS = 15_000;

/** How long we wait for a freshly opened tab's spec to finish loading. */
const SPEC_LOAD_WAIT_MS = 15_000;

const PIPELINE_PROTOCOL = "pipeline://";

function lastPipelineStorageKey(projectId: string): string {
  return `tangent:lastPipeline:${projectId}`;
}

function readLastPipelineRef(projectId: string): PipelineRef | undefined {
  try {
    const raw = sessionStorage.getItem(lastPipelineStorageKey(projectId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof parsed.name === "string"
    ) {
      const fileId =
        "fileId" in parsed && typeof parsed.fileId === "string"
          ? parsed.fileId
          : undefined;
      return { name: parsed.name, fileId };
    }
  } catch {
    // Ignore malformed/unavailable storage; fall back to resource inference.
  }
  return undefined;
}

function writeLastPipelineRef(projectId: string, ref: PipelineRef): void {
  try {
    sessionStorage.setItem(
      lastPipelineStorageKey(projectId),
      JSON.stringify(ref),
    );
  } catch {
    // Best-effort only.
  }
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
  const { backendUrl } = useBackend();
  const {
    newSession,
    addResource: addSessionResource,
    removeResource: removeSessionResource,
  } = useTangent();
  const tabs = useTangentSessionTabs();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [workareaTabs, setWorkareaTabs] = useState<WorkareaTab[]>([]);
  const [activeWorkareaTabId, setActiveWorkareaTabId] = useState<string | null>(
    null,
  );
  // Each pipeline tab's editor agent connects its own remote-env environment;
  // we track tabId -> environmentId (plus pending waiters) in refs so the
  // workarea tools can resolve a spawn target without triggering re-renders.
  const tabEnvironmentsRef = useRef(new Map<string, string>());
  const tabEnvironmentWaitersRef = useRef(
    new Map<string, Set<(environmentId: string) => void>>(),
  );
  // Each pipeline tab publishes its live ToolBridgeApi here so the project-level
  // editor agent can drive whichever pipeline is active. `activeWorkareaTabId`
  // is mirrored to a ref because `getActiveTabBridge` is read from the worker
  // (via a stable routing bridge) outside React's render cycle.
  const tabBridgesRef = useRef(new Map<string, ToolBridgeApi>());
  const activeWorkareaTabIdRef = useRef<string | null>(null);
  // Each pipeline tab surfaces its isolated SharedUIStore here so the embedded
  // chat's entity chips navigate/focus the active canvas. Kept in state (not a
  // ref) so the chat re-wraps when the active tab or its store changes.
  const [tabStores, setTabStores] = useState<Record<string, SharedUIStore>>({});
  // Waiters resolved when a tab's store is (re)published, so `revealEntity` can
  // navigate a freshly opened tab once its editor mounts and registers.
  const tabStoreWaitersRef = useRef(
    new Map<string, Set<(store: SharedUIStore) => void>>(),
  );

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

  useEffect(() => {
    activeWorkareaTabIdRef.current = activeWorkareaTabId;
  }, [activeWorkareaTabId]);

  const { resetTabs } = tabs;
  useEffect(() => {
    resetTabs();
    setWorkareaTabs([]);
    setActiveWorkareaTabId(null);
    tabEnvironmentsRef.current.clear();
    tabEnvironmentWaitersRef.current.clear();
    tabBridgesRef.current.clear();
    tabStoreWaitersRef.current.clear();
    setTabStores({});
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
        if (cancelled) return;
        if (project?.memory) {
          await addSessionResource(
            activeSessionId,
            toMemoryResourceInput(project.memory),
          );
        }
      } catch (error) {
        if (!cancelled) notify(getErrorMessage(error), "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, projectId, project?.memory, addSessionResource, notify]);

  function selectSession(sessionId: string) {
    void setActiveSession(projectId, sessionId);
  }

  async function setMemory(content: string) {
    await setProjectMemory(projectId, content);
    if (!activeSessionId) return;
    try {
      await addSessionResource(activeSessionId, toMemoryResourceInput(content));
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  async function startSession() {
    if (isStartingSession) return;
    setIsStartingSession(true);
    try {
      const projectResources = await listProjectResources(projectId);
      const seededResources = [
        ...projectResources.map(toHostResourceInput),
        ...(project?.memory?.trim()
          ? [toMemoryResourceInput(project.memory)]
          : []),
      ];
      const { sessionId } = await newSession(
        "New Tangent session",
        TANGENT_BUNDLE_ID,
        { resources: seededResources },
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

  function openArtifactTab(url: string, title: string): WorkareaTab {
    const existing = workareaTabs.find(
      (tab) => tab.kind === "artifact" && tab.url === url,
    );
    if (existing) {
      setActiveWorkareaTabId(existing.id);
      return existing;
    }
    const tab: WorkareaTab = {
      id: crypto.randomUUID(),
      kind: "artifact",
      title,
      url,
    };
    setWorkareaTabs((prev) => [...prev, tab]);
    setActiveWorkareaTabId(tab.id);
    return tab;
  }

  function openPipelineTab(
    pipelineRef: PipelineRef,
    title: string,
  ): WorkareaTab {
    writeLastPipelineRef(projectId, pipelineRef);
    const existing = workareaTabs.find(
      (tab) =>
        tab.kind === "pipeline" &&
        (pipelineRef.fileId
          ? tab.pipelineRef.fileId === pipelineRef.fileId
          : tab.pipelineRef.name === pipelineRef.name),
    );
    if (existing) {
      setActiveWorkareaTabId(existing.id);
      return existing;
    }
    const tab: WorkareaTab = {
      id: crypto.randomUUID(),
      kind: "pipeline",
      title,
      pipelineRef,
    };
    setWorkareaTabs((prev) => [...prev, tab]);
    setActiveWorkareaTabId(tab.id);
    return tab;
  }

  async function openWorkareaTarget(
    target: string,
    title?: string,
  ): Promise<WorkareaTab> {
    const view = await resolveWorkareaTarget(target, { backendUrl, title });
    if (view.kind === "artifact") {
      return openArtifactTab(view.url, view.title);
    }
    return openPipelineTab(view.pipelineRef, view.title);
  }

  function selectWorkareaTab(id: string) {
    setActiveWorkareaTabId(id);
  }

  function closeWorkareaTab(id: string) {
    unregisterTabEnvironment(id);
    unregisterTabBridge(id);
    unregisterTabStore(id);
    setWorkareaTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== id);
      setActiveWorkareaTabId((current) => {
        if (current !== id) return current;
        return next.length > 0 ? next[next.length - 1].id : null;
      });
      return next;
    });
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
        new Set<(environmentId: string) => void>();
      tabEnvironmentWaitersRef.current.set(tabId, waiters);
      const onReady = (environmentId: string) => {
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

  function registerTabBridge(tabId: string, bridge: ToolBridgeApi) {
    tabBridgesRef.current.set(tabId, bridge);
  }

  function unregisterTabBridge(tabId: string) {
    tabBridgesRef.current.delete(tabId);
  }

  function getActiveTabBridge(): ToolBridgeApi | undefined {
    const activeId = activeWorkareaTabIdRef.current;
    if (!activeId) return undefined;
    return tabBridgesRef.current.get(activeId);
  }

  function registerTabStore(tabId: string, store: SharedUIStore) {
    setTabStores((prev) =>
      prev[tabId] === store ? prev : { ...prev, [tabId]: store },
    );
    const waiters = tabStoreWaitersRef.current.get(tabId);
    if (!waiters) return;
    tabStoreWaitersRef.current.delete(tabId);
    for (const resolve of waiters) resolve(store);
  }

  function unregisterTabStore(tabId: string) {
    setTabStores((prev) => {
      if (!(tabId in prev)) return prev;
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  }

  function waitForTabStore(
    tabId: string,
    timeoutMs: number = DEFAULT_STORE_WAIT_MS,
  ): Promise<SharedUIStore | undefined> {
    const existing = tabStores[tabId];
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const waiters =
        tabStoreWaitersRef.current.get(tabId) ??
        new Set<(store: SharedUIStore) => void>();
      tabStoreWaitersRef.current.set(tabId, waiters);
      const onReady = (store: SharedUIStore) => {
        clearTimeout(timer);
        resolve(store);
      };
      const timer = setTimeout(() => {
        waiters.delete(onReady);
        resolve(undefined);
      }, timeoutMs);
      waiters.add(onReady);
    });
  }

  function getLastPipelineRef(): PipelineRef | undefined {
    const stored = readLastPipelineRef(projectId);
    if (stored) return stored;

    const pipelineResources = resources.filter(
      (resource) => resource.type === "pipeline",
    );
    if (pipelineResources.length !== 1) return undefined;

    const only = pipelineResources[0];
    if (!only.url.startsWith(PIPELINE_PROTOCOL)) return undefined;
    return {
      name: only.name,
      fileId: only.url.slice(PIPELINE_PROTOCOL.length),
    };
  }

  function focusEntityInStore(
    store: SharedUIStore,
    entityId: string,
    label: string,
  ): boolean {
    const resolved = resolveChatEntity(
      store.navigation.rootSpec,
      entityId,
      label,
    );
    if (!resolved) return false;
    const rootName = store.navigation.rootSpec?.name;
    navigateToEntity(
      store.editor,
      store.navigation,
      rootName ? [rootName] : [],
      resolved.entityId,
      resolved.kind,
    );
    return true;
  }

  async function focusEntityInTab(
    tabId: string,
    entityId: string,
    label: string,
  ): Promise<boolean> {
    const store = tabStores[tabId] ?? (await waitForTabStore(tabId));
    if (!store) return false;
    if (!store.navigation.rootSpec) {
      await when(() => store.navigation.rootSpec != null, {
        timeout: SPEC_LOAD_WAIT_MS,
      }).catch(() => undefined);
    }
    return focusEntityInStore(store, entityId, label);
  }

  async function revealEntity(
    entityId: string,
    label: string,
  ): Promise<boolean> {
    for (const tab of workareaTabs) {
      if (tab.kind !== "pipeline") continue;
      const store = tabStores[tab.id];
      if (store && focusEntityInStore(store, entityId, label)) {
        selectWorkareaTab(tab.id);
        return true;
      }
    }

    const pipelineRef = getLastPipelineRef();
    if (!pipelineRef) return false;
    const tab = openPipelineTab(pipelineRef, pipelineRef.name);
    selectWorkareaTab(tab.id);
    return focusEntityInTab(tab.id, entityId, label);
  }

  const activeTabStore = activeWorkareaTabId
    ? tabStores[activeWorkareaTabId]
    : undefined;

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
    memory: project?.memory ?? "",
    selectSession,
    startSession,
    setMemory,
    attachResource,
    detachResource,
    tabs,
    workareaTabs,
    activeWorkareaTabId,
    openArtifactTab,
    openPipelineTab,
    openWorkareaTarget,
    selectWorkareaTab,
    closeWorkareaTab,
    registerTabEnvironment,
    unregisterTabEnvironment,
    getTabEnvironmentId,
    waitForTabEnvironment,
    registerTabBridge,
    unregisterTabBridge,
    getActiveTabBridge,
    registerTabStore,
    unregisterTabStore,
    waitForTabStore,
    activeTabStore,
    revealEntity,
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
