import type {
  EmbedAgent,
  EmbedAsset,
  HostResourceInput,
  MemoryBinding,
} from "@tangent/embed-react";
import type { ThinkingLevel } from "@tangent/shared/contracts.ts";
import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { TANGENT_BUNDLE_ID } from "@/routes/v2/pages/Tangent/constants";
import { projectSharedMemorySeed } from "@/routes/v2/pages/Tangent/services/projectSharedMemory";
import { resolveWorkareaTarget } from "@/routes/v2/pages/Tangent/services/resolveWorkareaTarget";
import { sessionMemorySeed } from "@/routes/v2/pages/Tangent/services/sessionMemory";
import { rootConfigSeed } from "@/routes/v2/pages/Tangent/services/sessionRunConfig";
import type {
  OpenTabs,
  ResolvedWorkareaView,
  WorkareaTab,
  WorkareaTarget,
} from "@/routes/v2/pages/Tangent/workarea/types";
import { resolveChatEntity } from "@/routes/v2/shared/components/AiChat/components/resolveChatEntity";
import { navigateToEntity } from "@/routes/v2/shared/store/focus.actions";
import type { SharedUIStore } from "@/routes/v2/shared/store/SharedStoreContext";
import { projectSelector } from "@/services/projects/projectSelector";
import {
  idIdentity,
  parseIdentity,
  sameTarget,
} from "@/services/projects/resourceTarget";
import { TANGENT_UI_RUN_SOURCE } from "@/utils/annotationKeys";
import { getErrorMessage } from "@/utils/string";

export const CHAT_TAB_VALUE = "chat";

/** Matches Tangent's Prime agent id (`PI_AGENT.id`) without depending on `@tangent/shared`. */
export const PRIME_AGENT_ID = "prime";

export interface AgentTab {
  id: string;
  title: string;
}

/** How long {@link TangentProjectStore.waitForTabEnvironment} waits. */
const DEFAULT_ENVIRONMENT_WAIT_MS = 15_000;

interface ChatSlice {
  tabs: AgentTab[];
  activeTab: string;
  selectedAssetId?: string;
}

interface TabBridgeRegistration {
  kind: "pipeline" | "run";
  bridge: ToolBridgeApi;
}

const NO_TABS: OpenTabs = { tabs: [], activeId: null };
const EMPTY_CHAT: ChatSlice = { tabs: [], activeTab: CHAT_TAB_VALUE };

interface NewSessionOptions {
  name: string;
  resources?: HostResourceInput[];
  env?: Record<string, string>;
  model?: string;
  thinkingDepth?: ThinkingLevel;
  tags?: string[];
  memory?: MemoryBinding;
}

/** Server I/O the store needs for session lifecycle, injected by the provider. */
export interface TangentSessionIo {
  newSession: (
    prompt: string,
    bundleId: string,
    options: NewSessionOptions,
  ) => Promise<{ sessionId: string }>;
  ensureSharedFolderId: () => Promise<string | undefined>;
  attachSession: (sessionId: string, name?: string) => Promise<{ id: string }>;
  detachSession: (resourceId: string) => Promise<void>;
  nameSessionIfUnnamed: (sessionId: string, prompt: string) => Promise<void>;
  notify: (message: string, type: "error") => void;
  projectInstructions?: string | null;
  recordSessionRun?: (
    sessionId: string,
    runId: string,
    name: string,
  ) => Promise<void>;
}

export interface StartSessionOptions {
  prompt?: string;
  name?: string;
  model?: string;
  thinkingDepth?: ThinkingLevel;
}

export interface OpenTargetOptions {
  // The chat a run was opened from, read before any await so a chat switch
  // meanwhile can't move it to another chat's runs.
  recordRunIn?: string;
}

/**
 * Owns only UI state, so that the workarea shell, the chat panels and the
 * out-of-render agent tools read it from one place. Sessions, project and
 * resources stay in TanStack Query.
 *
 * The workarea's tabs belong to the project, so what's open stays open as its
 * chats change. A chat's own tabs are keyed by session id and restored on
 * switch. The live tab wiring — stores, environments, bridges — is keyed by
 * globally unique tab id, so tabs clean up on unmount without a session-scoped
 * reset.
 */
export class TangentProjectStore {
  readonly projectId: string;

  @observable accessor selectedSessionId: string | undefined = undefined;
  @observable accessor defaultSessionId: string | undefined = undefined;
  @observable accessor isStartingSession = false;
  /** Someone asked for the cursor in the project card's search. A card
   * that isn't on screen yet takes it as soon as it shows. */
  @observable accessor searchFocusRequested = false;

  @observable.ref accessor openTabs: OpenTabs;
  @observable.shallow accessor chatBySession = new Map<string, ChatSlice>();

  // Live tab wiring is intentionally non-observable: it's registered/read by the
  // out-of-render agent tools and routing bridge, not by React render.
  #tabStores = new Map<string, SharedUIStore>();
  #tabEnvironments = new Map<string, string>();
  #tabEnvironmentWaiters = new Map<
    string,
    Set<(environmentId: string | undefined) => void>
  >();
  #tabBridges = new Map<string, TabBridgeRegistration>();
  #lastEditorTabId: string | null = null;
  // A tab's view mounts the first time it's in front, so a project that comes
  // back with several tabs loads the one in view, not all of them at once.
  #shownTabIds = new Set<string>();

  #freshSessions = new Map<string, string>();
  #sessionsWithPrompt = new Set<string>();
  #io: TangentSessionIo | null = null;

  constructor(projectId: string, openTabs: OpenTabs = NO_TABS) {
    this.projectId = projectId;
    this.openTabs = openTabs;
    makeObservable(this);
    if (openTabs.activeId) this.#shownTabIds.add(openTabs.activeId);
  }

  @action setSessionIo(io: TangentSessionIo) {
    this.#io = io;
  }

  // The selected session wins while it exists; otherwise fall back to the most
  // recent attached session (the server list is newest-first).
  @computed get activeSessionId(): string | undefined {
    return this.selectedSessionId ?? this.defaultSessionId;
  }

  @computed get workareaTabs(): WorkareaTab[] {
    return this.openTabs.tabs;
  }

  @computed get activeWorkareaTabId(): string | null {
    return this.openTabs.activeId;
  }

  @computed get chatSlice(): ChatSlice {
    const sessionId = this.activeSessionId;
    return (
      (sessionId ? this.chatBySession.get(sessionId) : undefined) ?? EMPTY_CHAT
    );
  }

  @computed get chatTabs(): AgentTab[] {
    return this.chatSlice.tabs;
  }

  @computed get chatActiveTab(): string {
    return this.chatSlice.activeTab;
  }

  @computed get selectedAssetId(): string | undefined {
    return this.chatSlice.selectedAssetId;
  }

  @computed get selectedAgentId(): string {
    return this.chatActiveTab === CHAT_TAB_VALUE
      ? PRIME_AGENT_ID
      : this.chatActiveTab;
  }

  @action requestSearchFocus() {
    this.searchFocusRequested = true;
  }

  @action clearSearchFocusRequest() {
    this.searchFocusRequested = false;
  }

  @action setDefaultSessionId(sessionId: string | undefined) {
    this.defaultSessionId = sessionId;
  }

  @action selectSession(sessionId: string) {
    const previous = this.activeSessionId;
    this.selectedSessionId = sessionId;
    if (previous && previous !== sessionId) {
      void this.discardEmptySession(previous);
    }
  }

  recordSessionPrompt(content: string) {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;
    if (!content.trim()) return;
    this.#sessionsWithPrompt.add(sessionId);
    // A session started inside a project has no opening prompt to be named
    // from, so its first message is the first chance to call it anything. The
    // agent replaces this with a better title once it has read the message.
    void this.#io?.nameSessionIfUnnamed(sessionId, content);
  }

  async startSession(options?: StartSessionOptions): Promise<boolean> {
    if (this.isStartingSession) return false;
    const io = this.#io;
    if (!io) return false;
    const previous = this.activeSessionId;
    runInAction(() => {
      this.isStartingSession = true;
    });
    try {
      // An empty prompt makes the embed skip the opening turn, so the human
      // types the first message; a non-empty one runs it immediately.
      const prompt = options?.prompt ?? "";
      const rootConfig = rootConfigSeed(this.projectId);
      const folderId = await io.ensureSharedFolderId();
      const sharedMemory = folderId
        ? projectSharedMemorySeed(folderId)
        : undefined;
      const sessionOptions = (
        shared: typeof sharedMemory,
      ): NewSessionOptions => ({
        name: options?.name ?? "New Tangent session",
        resources: [
          {
            kind: "memory",
            scope: "session",
            content: sessionMemorySeed(this.projectId, io.projectInstructions, {
              hasSharedFolder: shared !== undefined,
            }),
          },
          rootConfig.resource,
          ...(shared ? [shared.resource] : []),
        ],
        // tangle-deploy and the bundle's submit tool write this as the run's
        // source; unset, the Tangent skill falls back to `tangent`.
        env: { ...rootConfig.env, TANGLE_DEPLOY_SOURCE: TANGENT_UI_RUN_SOURCE },
        model: options?.model,
        thinkingDepth: options?.thinkingDepth,
        tags: [projectSelector(this.projectId)],
        ...(shared ? { memory: shared.memory } : {}),
      });
      const { sessionId } = await io
        .newSession(prompt, TANGENT_BUNDLE_ID, sessionOptions(sharedMemory))
        .catch((error: unknown) => {
          if (!sharedMemory) throw error;
          // The stored folder id may be unknown to this Tangent server (base
          // URL changed, data reset, bad PATCH). Re-reading it would fail the
          // same way on every start, so the session goes without the folder.
          console.error(
            "Failed to start a session with the project's shared folder; retrying without it",
            error,
          );
          return io.newSession(
            prompt,
            TANGENT_BUNDLE_ID,
            sessionOptions(undefined),
          );
        });
      const resource = await io.attachSession(sessionId, options?.name);
      runInAction(() => {
        this.#freshSessions.set(sessionId, resource.id);
        this.selectedSessionId = sessionId;
      });
      if (prompt.trim()) {
        this.#sessionsWithPrompt.add(sessionId);
      }
      if (previous && previous !== sessionId) {
        await this.discardEmptySession(previous);
      }
      return true;
    } catch (error) {
      io.notify(getErrorMessage(error), "error");
      return false;
    } finally {
      runInAction(() => {
        this.isStartingSession = false;
      });
    }
  }

  // Only sessions started this mount are eligible for auto-discard; a
  // never-prompted one is detached + deleted on switch/unmount.
  async discardEmptySession(sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    const resourceId = this.#freshSessions.get(sessionId);
    if (!resourceId) return;
    if (this.#sessionsWithPrompt.has(sessionId)) return;
    this.#freshSessions.delete(sessionId);
    this.dropSession(sessionId);
    try {
      await this.#io?.detachSession(resourceId);
    } catch (error) {
      this.#io?.notify(getErrorMessage(error), "error");
    }
  }

  discardActiveSessionOnUnmount(): Promise<void> {
    return this.discardEmptySession(this.activeSessionId);
  }

  @action dropSession(sessionId: string) {
    this.chatBySession.delete(sessionId);
  }

  openArtifactTab(url: string, title: string): WorkareaTab {
    return this.openResolvedView({
      title,
      target: { type: "artifact", identity: idIdentity(url) },
    });
  }

  // Target entry point for opening the workarea from the resources dock, chat,
  // or agents. Resolves the target's title, then routes it through the registry.
  async openWorkareaTarget(
    target: WorkareaTarget,
    title?: string,
    options: OpenTargetOptions = {},
  ): Promise<WorkareaTab> {
    const view = await resolveWorkareaTarget(target, { title });
    return this.openResolvedView(view, options);
  }

  /**
   * The tabs belong to the project, not to whichever chat is open, so a run
   * joins a chat's runs only when it's opened from that chat.
   */
  @action openResolvedView(
    view: ResolvedWorkareaView,
    { recordRunIn }: OpenTargetOptions = {},
  ): WorkareaTab {
    if (recordRunIn && view.target.type === "run") {
      // Best effort: the run still opens if the chat can't note it down.
      void this.#io
        ?.recordSessionRun?.(
          recordRunIn,
          parseIdentity(view.target.identity).value,
          view.title,
        )
        .catch(() => undefined);
    }
    const tabs = this.workareaTabs;
    const existing = tabs.find((tab) => sameTarget(tab.target, view.target));
    if (existing) {
      this.#setTabs(tabs, existing.id);
      return existing;
    }
    const tab: WorkareaTab = { ...view, id: crypto.randomUUID() };
    this.#setTabs([...tabs, tab], tab.id);
    return tab;
  }

  // A tab's title is resolved once, when it opens, so a rename is the only
  // thing that can tell a tab the name it announces has changed.
  @action retitleWorkareaTarget(target: WorkareaTarget, title: string) {
    const tabs = this.workareaTabs;
    const index = tabs.findIndex((tab) => sameTarget(tab.target, target));
    if (index < 0 || tabs[index].title === title) return;
    const next = [...tabs];
    next[index] = { ...next[index], title };
    this.#setTabs(next, this.activeWorkareaTabId);
  }

  @action replaceWorkareaTabTarget(tabId: string, target: WorkareaTarget) {
    const tabs = this.workareaTabs;
    if (!tabs.some((tab) => tab.id === tabId)) return;
    this.#setTabs(
      tabs.map((tab) => (tab.id === tabId ? { ...tab, target } : tab)),
      this.activeWorkareaTabId,
    );
  }

  @action replaceWorkareaTarget(
    previous: WorkareaTarget,
    target: WorkareaTarget,
  ) {
    this.#setTabs(
      this.workareaTabs.map((tab) =>
        sameTarget(tab.target, previous) ? { ...tab, target } : tab,
      ),
      this.activeWorkareaTabId,
    );
  }

  @action selectWorkareaTab(id: string) {
    const tabs = this.workareaTabs;
    if (!tabs.some((tab) => tab.id === id)) return;
    this.#setTabs(tabs, id);
  }

  hasShownTab(id: string): boolean {
    return this.#shownTabIds.has(id);
  }

  @action closeWorkareaTab(id: string) {
    this.unregisterTabEnvironment(id);
    this.unregisterTabBridge(id);
    this.#shownTabIds.delete(id);
    const tabs = this.workareaTabs;
    const next = tabs.filter((tab) => tab.id !== id);
    const nextActiveId =
      this.activeWorkareaTabId === id
        ? (next.at(-1)?.id ?? null)
        : this.activeWorkareaTabId;
    this.#setTabs(next, nextActiveId);
  }

  @action openAgent(agent: EmbedAgent) {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;
    const prev = this.chatBySession.get(sessionId) ?? EMPTY_CHAT;
    if (agent.kind === "prime") {
      this.chatBySession.set(sessionId, {
        ...prev,
        activeTab: CHAT_TAB_VALUE,
      });
      return;
    }
    const tabs = prev.tabs.some((tab) => tab.id === agent.id)
      ? prev.tabs
      : [...prev.tabs, { id: agent.id, title: agent.name }];
    this.chatBySession.set(sessionId, { ...prev, tabs, activeTab: agent.id });
  }

  @action closeChatTab(id: string) {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;
    const prev = this.chatBySession.get(sessionId) ?? EMPTY_CHAT;
    this.chatBySession.set(sessionId, {
      ...prev,
      tabs: prev.tabs.filter((tab) => tab.id !== id),
      activeTab: prev.activeTab === id ? CHAT_TAB_VALUE : prev.activeTab,
    });
  }

  @action selectAsset(asset: EmbedAsset) {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;
    const prev = this.chatBySession.get(sessionId) ?? EMPTY_CHAT;
    this.chatBySession.set(sessionId, { ...prev, selectedAssetId: asset.id });
  }

  @action setChatActiveTab(value: string) {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;
    const prev = this.chatBySession.get(sessionId) ?? EMPTY_CHAT;
    this.chatBySession.set(sessionId, { ...prev, activeTab: value });
  }

  registerTabStore(tabId: string, store: SharedUIStore) {
    this.#tabStores.set(tabId, store);
  }

  unregisterTabStore(tabId: string) {
    this.#tabStores.delete(tabId);
  }

  // Reveal an `entity://` chat chip: find the open pipeline tab whose live spec
  // owns the entity, activate it, and focus the entity on its canvas. Returns
  // false when no open pipeline tab resolves the id/label (the chip is inert).
  revealEntity(entityId: string, label: string): boolean {
    for (const tab of this.workareaTabs) {
      if (tab.target.type !== "pipeline") continue;
      const store = this.#tabStores.get(tab.id);
      if (store && this.#focusEntityInStore(store, entityId, label)) {
        this.selectWorkareaTab(tab.id);
        return true;
      }
    }
    return false;
  }

  #focusEntityInStore(
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
      rootName ? [rootName, ...resolved.subgraphTaskNames] : [],
      resolved.entityId,
      resolved.kind,
    );
    return true;
  }

  registerTabEnvironment(tabId: string, environmentId: string) {
    this.#tabEnvironments.set(tabId, environmentId);
    const waiters = this.#tabEnvironmentWaiters.get(tabId);
    if (!waiters) return;
    this.#tabEnvironmentWaiters.delete(tabId);
    for (const resolve of waiters) resolve(environmentId);
  }

  unregisterTabEnvironment(tabId: string) {
    this.#tabEnvironments.delete(tabId);
    const waiters = this.#tabEnvironmentWaiters.get(tabId);
    if (!waiters) return;
    this.#tabEnvironmentWaiters.delete(tabId);
    for (const resolve of waiters) resolve(undefined);
  }

  getTabEnvironmentId(tabId: string): string | undefined {
    return this.#tabEnvironments.get(tabId);
  }

  waitForTabEnvironment(
    tabId: string,
    timeoutMs: number = DEFAULT_ENVIRONMENT_WAIT_MS,
  ): Promise<string | undefined> {
    const existing = this.#tabEnvironments.get(tabId);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const waiters =
        this.#tabEnvironmentWaiters.get(tabId) ??
        new Set<(environmentId: string | undefined) => void>();
      this.#tabEnvironmentWaiters.set(tabId, waiters);
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

  registerTabBridge(
    tabId: string,
    kind: "pipeline" | "run",
    bridge: ToolBridgeApi,
  ) {
    this.#tabBridges.set(tabId, { kind, bridge });
  }

  unregisterTabBridge(tabId: string) {
    this.#tabBridges.delete(tabId);
  }

  getActiveTabBridge(): ToolBridgeApi | undefined {
    const activeId = this.activeWorkareaTabId;
    const activeTab = this.workareaTabs.find((tab) => tab.id === activeId);
    if (activeTab?.target.type === "run") return undefined;
    const activeRegistration = activeId
      ? this.#tabBridges.get(activeId)
      : undefined;
    if (activeRegistration?.kind === "pipeline") {
      return activeRegistration.bridge;
    }
    const fallbackRegistration = this.#lastEditorTabId
      ? this.#tabBridges.get(this.#lastEditorTabId)
      : undefined;
    return fallbackRegistration?.kind === "pipeline"
      ? fallbackRegistration.bridge
      : undefined;
  }

  #setTabs(tabs: WorkareaTab[], activeId: string | null) {
    this.openTabs = { tabs, activeId };
    if (activeId) this.#shownTabIds.add(activeId);
    this.#syncLastEditor();
  }

  // The editor-bridge fallback keeps the active pipeline tab when one is
  // focused, otherwise the still-open last editor tab, otherwise the newest
  // pipeline among the open tabs.
  #syncLastEditor() {
    const tabs = this.workareaTabs;
    const activeTab = tabs.find((tab) => tab.id === this.activeWorkareaTabId);
    if (activeTab?.target.type === "pipeline") {
      this.#lastEditorTabId = activeTab.id;
      return;
    }
    if (tabs.some((tab) => tab.id === this.#lastEditorTabId)) return;
    const lastPipelineTab = [...tabs]
      .reverse()
      .find((tab) => tab.target.type === "pipeline");
    this.#lastEditorTabId = lastPipelineTab?.id ?? null;
  }
}
