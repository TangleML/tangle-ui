import type { EmbedAgent, EmbedAsset } from "@tangent/embed-react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { ComponentSpec, Input, Output, Task } from "@/models/componentSpec";
import type { WorkareaTarget } from "@/routes/v2/pages/Tangent/workarea/types";
import type { SharedUIStore } from "@/routes/v2/shared/store/SharedStoreContext";
import { idIdentity } from "@/services/projects/resourceTarget";

import {
  CHAT_TAB_VALUE,
  PRIME_AGENT_ID,
  TangentProjectStore,
  type TangentSessionIo,
} from "./TangentProjectStore";

const SESSION_A = "session-a";
const SESSION_B = "session-b";

const prime: EmbedAgent = {
  id: PRIME_AGENT_ID,
  name: "Prime",
  kind: "prime",
  status: "active",
  conversationId: "conv-prime",
};

const researcher: EmbedAgent = {
  id: "agent-1",
  name: "Researcher",
  kind: "subagent",
  status: "active",
  conversationId: "conv-1",
};

const builder: EmbedAgent = {
  id: "agent-2",
  name: "Builder",
  kind: "subagent",
  status: "active",
  conversationId: "conv-2",
};

function asset(id: string): EmbedAsset {
  return { id, url: `https://x/${id}`, title: id, kind: "file" } as EmbedAsset;
}

function pipeline(id: string): WorkareaTarget {
  return { type: "pipeline", identity: idIdentity(id) };
}

function run(id: string): WorkareaTarget {
  return { type: "run", identity: idIdentity(id) };
}

function artifact(url: string): WorkareaTarget {
  return { type: "artifact", identity: idIdentity(url) };
}

function makeBridge(id: string): ToolBridgeApi {
  return { __id: id } as unknown as ToolBridgeApi;
}

function activeStore(sessionId = SESSION_A): TangentProjectStore {
  const store = new TangentProjectStore("project-1");
  store.setDefaultSessionId(sessionId);
  return store;
}

describe("TangentProjectStore chat tabs", () => {
  it("starts on the Chat tab with Prime selected and no agent tabs", () => {
    const store = activeStore();

    expect(store.chatTabs).toEqual([]);
    expect(store.chatActiveTab).toBe(CHAT_TAB_VALUE);
    expect(store.selectedAgentId).toBe(PRIME_AGENT_ID);
  });

  it("focuses Chat and does not add a tab when Prime is opened", () => {
    const store = activeStore();

    store.openAgent(researcher);
    store.openAgent(prime);

    expect(store.chatTabs).toEqual([
      { id: researcher.id, title: researcher.name },
    ]);
    expect(store.chatActiveTab).toBe(CHAT_TAB_VALUE);
    expect(store.selectedAgentId).toBe(PRIME_AGENT_ID);
  });

  it("adds a tab and focuses it when a sub-agent is opened", () => {
    const store = activeStore();

    store.openAgent(researcher);

    expect(store.chatTabs).toEqual([
      { id: researcher.id, title: researcher.name },
    ]);
    expect(store.chatActiveTab).toBe(researcher.id);
    expect(store.selectedAgentId).toBe(researcher.id);
  });

  it("focuses an existing tab without duplicating it", () => {
    const store = activeStore();

    store.openAgent(researcher);
    store.openAgent(builder);
    store.openAgent(researcher);

    expect(store.chatTabs).toEqual([
      { id: researcher.id, title: researcher.name },
      { id: builder.id, title: builder.name },
    ]);
    expect(store.chatActiveTab).toBe(researcher.id);
  });

  it("falls back to Chat when the active tab is closed", () => {
    const store = activeStore();

    store.openAgent(researcher);
    store.closeChatTab(researcher.id);

    expect(store.chatTabs).toEqual([]);
    expect(store.chatActiveTab).toBe(CHAT_TAB_VALUE);
    expect(store.selectedAgentId).toBe(PRIME_AGENT_ID);
  });

  it("leaves the active tab unchanged when an inactive tab is closed", () => {
    const store = activeStore();

    store.openAgent(researcher);
    store.openAgent(builder);
    store.closeChatTab(researcher.id);

    expect(store.chatTabs).toEqual([{ id: builder.id, title: builder.name }]);
    expect(store.chatActiveTab).toBe(builder.id);
  });

  it("records the selected asset id", () => {
    const store = activeStore();

    store.selectAsset(asset("a1"));

    expect(store.selectedAssetId).toBe("a1");
  });

  it("keeps each session's chat independent and restores it on switch", () => {
    const store = activeStore(SESSION_A);

    store.openAgent(researcher);
    expect(store.chatTabs).toEqual([
      { id: researcher.id, title: researcher.name },
    ]);

    store.selectSession(SESSION_B);
    expect(store.chatTabs).toEqual([]);
    expect(store.chatActiveTab).toBe(CHAT_TAB_VALUE);

    store.openAgent(builder);
    expect(store.chatTabs).toEqual([{ id: builder.id, title: builder.name }]);

    store.selectSession(SESSION_A);
    expect(store.chatTabs).toEqual([
      { id: researcher.id, title: researcher.name },
    ]);
    expect(store.chatActiveTab).toBe(researcher.id);
  });

  it("no-ops when there is no active session", () => {
    const store = new TangentProjectStore("project-1");

    store.openAgent(researcher);

    expect(store.chatTabs).toEqual([]);
    expect(store.chatActiveTab).toBe(CHAT_TAB_VALUE);
    expect(store.selectedAgentId).toBe(PRIME_AGENT_ID);
  });
});

describe("TangentProjectStore workarea tabs", () => {
  it("refuses to open a tab while no session is active", () => {
    const store = new TangentProjectStore("project-1");

    expect(() =>
      store.openResolvedView({ title: "P1", target: pipeline("p1") }),
    ).toThrow(/No active Tangent session/);
    expect(store.workareaTabs).toEqual([]);
  });

  it("focuses an existing target instead of opening a duplicate", () => {
    const store = activeStore();

    const first = store.openResolvedView({
      title: "P1",
      target: pipeline("p1"),
    });
    store.openResolvedView({ title: "P2", target: pipeline("p2") });
    const again = store.openResolvedView({
      title: "P1",
      target: pipeline("p1"),
    });

    expect(again.id).toBe(first.id);
    expect(store.workareaTabs).toHaveLength(2);
    expect(store.activeWorkareaTabId).toBe(first.id);
  });

  it("selects the last remaining tab when the active tab is closed", () => {
    const store = activeStore();

    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    const p2 = store.openResolvedView({ title: "P2", target: pipeline("p2") });

    store.closeWorkareaTab(p2.id);

    expect(store.workareaTabs.map((tab) => tab.id)).toEqual([p1.id]);
    expect(store.activeWorkareaTabId).toBe(p1.id);
  });

  it("leaves the active tab unchanged when an inactive tab is closed", () => {
    const store = activeStore();

    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    const p2 = store.openResolvedView({ title: "P2", target: pipeline("p2") });

    store.closeWorkareaTab(p1.id);

    expect(store.workareaTabs.map((tab) => tab.id)).toEqual([p2.id]);
    expect(store.activeWorkareaTabId).toBe(p2.id);
  });

  it("keeps each session's workarea independent and restores it on switch", () => {
    const store = activeStore(SESSION_A);

    const a = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    expect(store.workareaTabs.map((tab) => tab.id)).toEqual([a.id]);

    store.selectSession(SESSION_B);
    expect(store.workareaTabs).toEqual([]);

    const b = store.openResolvedView({ title: "P2", target: pipeline("p2") });
    expect(store.workareaTabs.map((tab) => tab.id)).toEqual([b.id]);

    store.selectSession(SESSION_A);
    expect(store.workareaTabs.map((tab) => tab.id)).toEqual([a.id]);
    expect(store.activeWorkareaTabId).toBe(a.id);
  });

  it("drops a session's workarea and chat on dropSession", () => {
    const store = activeStore(SESSION_A);
    store.openResolvedView({ title: "P1", target: pipeline("p1") });
    store.openAgent(researcher);

    store.dropSession(SESSION_A);

    expect(store.workareaTabs).toEqual([]);
    expect(store.chatTabs).toEqual([]);
  });
});

describe("TangentProjectStore.getActiveTabBridge", () => {
  it("returns the active pipeline tab's bridge", () => {
    const store = activeStore();
    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    const bridge = makeBridge("p1");
    store.registerTabBridge(p1.id, "pipeline", bridge);

    expect(store.getActiveTabBridge()).toBe(bridge);
  });

  it("falls back to the last editor tab when an artifact is focused", () => {
    const store = activeStore();
    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    const bridge = makeBridge("p1");
    store.registerTabBridge(p1.id, "pipeline", bridge);
    store.openResolvedView({ title: "A", target: artifact("http://a") });

    expect(store.activeWorkareaTabId).not.toBe(p1.id);
    expect(store.getActiveTabBridge()).toBe(bridge);
  });

  it("returns undefined while a run tab is focused", () => {
    const store = activeStore();
    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    store.registerTabBridge(p1.id, "pipeline", makeBridge("p1"));
    const r1 = store.openResolvedView({ title: "R1", target: run("r1") });
    store.registerTabBridge(r1.id, "run", makeBridge("r1"));

    expect(store.getActiveTabBridge()).toBeUndefined();
  });

  it("falls back to the newest remaining pipeline when the last editor closes", () => {
    const store = activeStore();
    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    const bridgeP1 = makeBridge("p1");
    store.registerTabBridge(p1.id, "pipeline", bridgeP1);
    const p2 = store.openResolvedView({ title: "P2", target: pipeline("p2") });
    store.registerTabBridge(p2.id, "pipeline", makeBridge("p2"));
    store.openResolvedView({ title: "A", target: artifact("http://a") });

    store.closeWorkareaTab(p2.id);

    expect(store.getActiveTabBridge()).toBe(bridgeP1);
  });
});

interface FakeSharedStore {
  editor: {
    setPendingFocusNode: ReturnType<typeof vi.fn>;
    selectNode: ReturnType<typeof vi.fn>;
  };
  navigation: {
    rootSpec: ComponentSpec | null;
    navigateToPath: ReturnType<typeof vi.fn>;
  };
}

function makeSharedStore(rootSpec: ComponentSpec | null): SharedUIStore {
  const fake: FakeSharedStore = {
    editor: { setPendingFocusNode: vi.fn(), selectNode: vi.fn() },
    navigation: { rootSpec, navigateToPath: vi.fn() },
  };
  return fake as unknown as SharedUIStore;
}

function specWithTask(): ComponentSpec {
  const spec = new ComponentSpec({ $id: "spec_1", name: "MyPipeline" });
  spec.addInput(new Input({ $id: "input_1", name: "rows", type: "Integer" }));
  spec.addOutput(
    new Output({ $id: "output_1", name: "result", type: "String" }),
  );
  spec.addTask(
    new Task({ $id: "task_1", name: "Load CSV", componentRef: { name: "l" } }),
  );
  return spec;
}

describe("TangentProjectStore.revealEntity", () => {
  it("activates the owning pipeline tab and focuses the entity", () => {
    const store = activeStore();
    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    const p2 = store.openResolvedView({ title: "P2", target: pipeline("p2") });
    const shared = makeSharedStore(specWithTask());
    store.registerTabStore(p2.id, shared);
    store.selectWorkareaTab(p1.id);

    expect(store.revealEntity("task_1", "Load CSV")).toBe(true);
    expect(store.activeWorkareaTabId).toBe(p2.id);
    expect(shared.navigation.navigateToPath).toHaveBeenCalledWith([
      "MyPipeline",
    ]);
    expect(shared.editor.selectNode).toHaveBeenCalledWith("task_1", "task");
  });

  it("resolves a drifted id by its label", () => {
    const store = activeStore();
    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    const shared = makeSharedStore(specWithTask());
    store.registerTabStore(p1.id, shared);

    expect(store.revealEntity("task_stale", "Load CSV")).toBe(true);
    expect(shared.editor.selectNode).toHaveBeenCalledWith("task_1", "task");
  });

  it("returns false when no open pipeline tab resolves the entity", () => {
    const store = activeStore();
    const p1 = store.openResolvedView({ title: "P1", target: pipeline("p1") });
    store.registerTabStore(p1.id, makeSharedStore(specWithTask()));

    expect(store.revealEntity("task_missing", "Nope")).toBe(false);
  });

  it("returns false when the pipeline tab has no registered store yet", () => {
    const store = activeStore();
    store.openResolvedView({ title: "P1", target: pipeline("p1") });

    expect(store.revealEntity("task_1", "Load CSV")).toBe(false);
  });
});

interface StartSessionIoMock extends TangentSessionIo {
  newSession: Mock<TangentSessionIo["newSession"]>;
  attachSession: Mock<TangentSessionIo["attachSession"]>;
  detachSession: Mock<TangentSessionIo["detachSession"]>;
  notify: Mock<TangentSessionIo["notify"]>;
}

function makeSessionIo(
  projectInstructions?: string | null,
): StartSessionIoMock {
  return {
    newSession: vi
      .fn<TangentSessionIo["newSession"]>()
      .mockResolvedValue({ sessionId: "new-session" }),
    attachSession: vi
      .fn<TangentSessionIo["attachSession"]>()
      .mockResolvedValue({ id: "resource-1" }),
    detachSession: vi
      .fn<TangentSessionIo["detachSession"]>()
      .mockResolvedValue(undefined),
    notify: vi.fn<TangentSessionIo["notify"]>(),
    projectInstructions,
  };
}

describe("TangentProjectStore.startSession", () => {
  it("seeds the project instructions as a session-scoped memory resource", async () => {
    const store = new TangentProjectStore("project-1");
    const io = makeSessionIo("Prefer concise plans.");
    store.setSessionIo(io);

    await store.startSession();

    expect(io.newSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      {
        name: "New Tangent session",
        resources: [
          {
            kind: "memory",
            scope: "session",
            content: "Prefer concise plans.",
          },
        ],
      },
    );
  });

  it("omits resources when there are no instructions", async () => {
    const store = new TangentProjectStore("project-1");
    const io = makeSessionIo(null);
    store.setSessionIo(io);

    await store.startSession();

    const options = io.newSession.mock.calls[0][2];
    expect(options.resources).toBeUndefined();
  });

  it("omits resources when the instructions are only whitespace", async () => {
    const store = new TangentProjectStore("project-1");
    const io = makeSessionIo("   \n  ");
    store.setSessionIo(io);

    await store.startSession();

    const options = io.newSession.mock.calls[0][2];
    expect(options.resources).toBeUndefined();
  });

  it("attaches the session after creating it", async () => {
    const store = new TangentProjectStore("project-1");
    const io = makeSessionIo("Standing context");
    store.setSessionIo(io);

    await store.startSession();

    expect(io.attachSession).toHaveBeenCalledWith("new-session");
    expect(io.newSession.mock.invocationCallOrder[0]).toBeLessThan(
      io.attachSession.mock.invocationCallOrder[0],
    );
  });

  it("runs the opening turn with the given prompt and session name", async () => {
    const store = new TangentProjectStore("project-1");
    const io = makeSessionIo(null);
    store.setSessionIo(io);

    await store.startSession({
      prompt: "Fix the failed run",
      name: "Repair run 7",
    });

    const [prompt, , options] = io.newSession.mock.calls[0];
    expect(prompt).toBe("Fix the failed run");
    expect(options.name).toBe("Repair run 7");
  });

  it("keeps a prompted session out of auto-discard", async () => {
    const store = new TangentProjectStore("project-1");
    const io = makeSessionIo(null);
    store.setSessionIo(io);

    await store.startSession({ prompt: "Fix it" });
    await store.discardActiveSessionOnUnmount();

    expect(io.detachSession).not.toHaveBeenCalled();
  });

  it("reports success only when a session was created", async () => {
    const withoutIo = new TangentProjectStore("project-1");
    await expect(withoutIo.startSession()).resolves.toBe(false);

    const withIo = new TangentProjectStore("project-1");
    withIo.setSessionIo(makeSessionIo(null));
    await expect(withIo.startSession()).resolves.toBe(true);
  });

  /**
   * A link asking for a new session arrives before Tangent is reachable, so
   * whoever acts on it has to be able to see that starting one would refuse.
   */
  it("says whether it can start one at all", () => {
    const store = new TangentProjectStore("project-1");
    expect(store.canStartSession).toBe(false);

    store.setSessionIo(makeSessionIo(null));

    expect(store.canStartSession).toBe(true);
  });
});

describe("TangentProjectStore.waitForTabEnvironment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when the environment is already registered", async () => {
    const store = activeStore();
    store.registerTabEnvironment("tab-1", "env-1");

    await expect(store.waitForTabEnvironment("tab-1")).resolves.toBe("env-1");
  });

  it("resolves when the environment is registered later", async () => {
    const store = activeStore();
    const pending = store.waitForTabEnvironment("tab-1");

    store.registerTabEnvironment("tab-1", "env-1");

    await expect(pending).resolves.toBe("env-1");
  });

  it("resolves undefined after the timeout", async () => {
    const store = activeStore();
    const pending = store.waitForTabEnvironment("tab-1", 1000);

    vi.advanceTimersByTime(1000);

    await expect(pending).resolves.toBeUndefined();
  });
});
