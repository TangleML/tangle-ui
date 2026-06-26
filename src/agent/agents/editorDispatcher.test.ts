import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentSession } from "../session";

const agentCtor = vi.hoisted(() => vi.fn());
const memorySessionCtor = vi.hoisted(() => vi.fn());
const runMock = vi.hoisted(() => vi.fn());
const attachObservabilityHooks = vi.hoisted(() => vi.fn());

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

  return {
    Agent: FakeAgent,
    MemorySession: FakeMemorySession,
    run: (...args: unknown[]) => runMock(...args),
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
    agentCtor.mockClear();
    memorySessionCtor.mockClear();
    runMock.mockReset();
    attachObservabilityHooks.mockClear();
    runMock.mockResolvedValue({ finalOutput: "Done" });
  });

  it("preserves Responses reasoning continuity for Sidekick runs", async () => {
    const dispatcher = createEditorDispatcher();
    await dispatcher.invoke({
      message: "add a component",
      threadId: "thread-1",
      aiConfig: {
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-5.5",
      },
      session: makeSession(),
    });

    const agentConfig = agentCtor.mock.calls.at(-1)?.[0];
    expect(agentConfig).toMatchObject({
      model: "gpt-5.5",
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
  });
});
