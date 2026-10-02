import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentSession } from "../session";

const agentCtor = vi.hoisted(() => vi.fn());
const memorySessionCtor = vi.hoisted(() => vi.fn());
const runMock = vi.hoisted(() => vi.fn());
const attachObservabilityHooks = vi.hoisted(() => vi.fn());
const providerCtor = vi.hoisted(() => vi.fn());

vi.mock("@openai/agents", () => {
  class FakeAgent {
    constructor(config: unknown) {
      agentCtor(config);
    }
  }

  class FakeMemorySession {
    constructor(options: unknown) {
      memorySessionCtor(options);
    }
  }

  class FakeOpenAIProvider {
    constructor(options: unknown) {
      providerCtor(options);
    }
  }

  class FakeRunner {
    run(...args: unknown[]) {
      return runMock(...args);
    }
  }

  return {
    Agent: FakeAgent,
    MemorySession: FakeMemorySession,
    OpenAIProvider: FakeOpenAIProvider,
    Runner: FakeRunner,
    tool: (config: unknown) => ({ type: "tool", config }),
  };
});

vi.mock("../middleware/observability", () => ({
  attachObservabilityHooks: (...args: unknown[]) =>
    attachObservabilityHooks(...args),
}));

const fakeSubAgent = {
  asTool: (config: unknown) => ({ type: "tool", config }),
};

vi.mock("./subagents/generalHelp", () => ({
  createGeneralHelpAgent: () => fakeSubAgent,
}));

vi.mock("./subagents/pipelineRepair", () => ({
  createPipelineRepairAgent: () => fakeSubAgent,
}));

vi.mock("./subagents/pipelineArchitect", () => ({
  createPipelineArchitectAgent: () => Promise.resolve(fakeSubAgent),
}));

vi.mock("./subagents/debugAssistant", () => ({
  createDebugAssistantAgent: () => fakeSubAgent,
}));

const { createEditorDispatcher } = await import("./editorDispatcher");

function makeSession(): AgentSession {
  const session = {
    threadId: "thread-1",
    emitStatus: vi.fn(),
    proxyClient: {
      ensureConfigured: vi.fn(),
      openai: {},
    },
    bridge: {},
    skillsLoader: {},
    aiConfig: {
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-5.5",
    },
    recentRuns: [],
  };

  // ProxyClient has private fields, so a duck-typed test double cannot satisfy
  // AgentSession structurally without this boundary cast.
  return session as unknown as AgentSession;
}

describe("createEditorDispatcher", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    agentCtor.mockClear();
    memorySessionCtor.mockClear();
    runMock.mockReset();
    attachObservabilityHooks.mockClear();
    providerCtor.mockClear();
    runMock.mockResolvedValue({ finalOutput: "Done" });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function assertDispatcher(aiConfig: Partial<AgentSession["aiConfig"]>) {
    const session = makeSession();
    session.aiConfig = { ...session.aiConfig, ...aiConfig };
    const selectedConfig = { ...session.aiConfig };
    const dispatcher = createEditorDispatcher();
    await dispatcher.invoke({
      message: "add a component",
      threadId: "thread-1",
      aiConfig: selectedConfig,
      session,
    });

    const agentConfig = agentCtor.mock.calls.at(-1)?.[0];
    expect(agentConfig).toMatchObject({
      model: selectedConfig.model,
      modelSettings: {
        providerData: {
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const options = runMock.mock.calls[0]?.[2];
    expect(options).toEqual({
      session: expect.any(Object),
    });
    if (aiConfig.reasoningEffort) {
      expect(agentConfig.modelSettings.reasoning).toEqual({
        effort: aiConfig.reasoningEffort,
      });
    } else {
      expect(agentConfig.modelSettings).not.toHaveProperty("reasoning");
    }
    expect(session.aiConfig).toEqual(selectedConfig);
    expect(fetch).not.toHaveBeenCalled();
    expect(runMock).toHaveBeenCalledOnce();
  }

  it.each([
    { model: "gpt-5.5" },
    { model: "gpt-6-sol", reasoningEffort: "high" },
    { model: "gpt-6-sol" },
  ] as const)(
    "preserves Responses continuity and selected config %j without a catalog request",
    assertDispatcher,
  );
});
