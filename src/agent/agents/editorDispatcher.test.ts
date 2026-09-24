import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAiResponsesModel } from "@/services/aiModelService";

import type { AgentSession } from "../session";

const agentCtor = vi.hoisted(() => vi.fn());
const memorySessionCtor = vi.hoisted(() => vi.fn());
const runMock = vi.hoisted(() => vi.fn());
const attachObservabilityHooks = vi.hoisted(() => vi.fn());
const providerCtor = vi.hoisted(() => vi.fn());

vi.mock("@/services/aiModelService", () => ({
  resolveAiResponsesModel: vi.fn(),
}));

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
    vi.mocked(resolveAiResponsesModel)
      .mockReset()
      .mockImplementation(async ({ model }) => model);
    agentCtor.mockClear();
    memorySessionCtor.mockClear();
    runMock.mockReset();
    attachObservabilityHooks.mockClear();
    providerCtor.mockClear();
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

  it("uses the callable model for the turn without changing the saved selection or thinking", async () => {
    vi.mocked(resolveAiResponsesModel).mockResolvedValue(
      "responses-provider:deployed-model",
    );
    const session = makeSession();
    session.aiConfig.model = "gpt-6-sol";
    session.aiConfig.reasoningEffort = "high";
    const selectedConfig = { ...session.aiConfig };

    await createEditorDispatcher().invoke({
      message: "Hello",
      threadId: session.threadId,
      aiConfig: selectedConfig,
      session,
    });

    expect(agentCtor.mock.calls.at(-1)?.[0]).toMatchObject({
      model: "responses-provider:deployed-model",
      modelSettings: { reasoning: { effort: "high" } },
    });
    expect(session.aiConfig).toEqual(selectedConfig);
    expect(resolveAiResponsesModel).toHaveBeenCalledWith(selectedConfig);
    expect(providerCtor).toHaveBeenCalledWith({
      openAIClient: session.proxyClient.openai,
      useResponses: true,
    });
  });

  it("does not run the agent when the selected model is unavailable", async () => {
    vi.mocked(resolveAiResponsesModel).mockRejectedValue(
      new Error("Choose another model"),
    );
    const session = makeSession();
    await expect(
      createEditorDispatcher().invoke({
        message: "Hello",
        threadId: session.threadId,
        aiConfig: session.aiConfig,
        session,
      }),
    ).rejects.toThrow("Choose another model");
    expect(runMock).not.toHaveBeenCalled();
  });

  it("preserves omitted thinking when the UI disables it for a configured model", async () => {
    const session = makeSession();
    session.aiConfig.model = "gpt-6-sol";

    await createEditorDispatcher().invoke({
      message: "Hello",
      threadId: session.threadId,
      aiConfig: session.aiConfig,
      session,
    });

    expect(agentCtor.mock.calls.at(-1)?.[0].modelSettings).not.toHaveProperty(
      "reasoning",
    );
  });
});
