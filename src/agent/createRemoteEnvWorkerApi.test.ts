import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProviderConfig } from "@/types/aiProvider";

import { buildRemoteEditorAgent } from "./agents/remoteEditorAgent";
import { MISSING_AI_PROVIDER } from "./config";
import { createRemoteEnvWorkerApi } from "./createRemoteEnvWorkerApi";
import { createSession } from "./session";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { AgentContext } from "./types";

const { runAgent } = vi.hoisted(() => ({ runAgent: vi.fn() }));

vi.mock("@openai/agents", () => ({
  MemorySession: class {
    constructor(_options: { sessionId: string }) {}
  },
  run: runAgent,
}));

vi.mock("./config", () => ({
  MISSING_AI_PROVIDER: "No AI provider is configured.",
  ProxyClient: class {
    ensureConfigured = vi.fn();
  },
}));

vi.mock("./skills/loader", () => ({
  SkillsLoader: class {},
}));

vi.mock("./agents/remoteEditorAgent", () => ({
  buildRemoteEditorAgent: vi.fn(() => ({})),
}));

vi.mock("./session", () => ({
  createSession: vi.fn(() => ({})),
}));

const bridge = {} as ToolBridgeApi;
const aiConfig: AiProviderConfig = {
  apiBase: "https://proxy.example/v1",
  apiKey: "",
  model: "gpt",
};
const onStatus = vi.fn();

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

describe("createRemoteEnvWorkerApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAgent.mockResolvedValue({ finalOutput: "answer" });
  });

  it("rejects a turn for an agent that was never spawned", async () => {
    const api = createRemoteEnvWorkerApi();
    api.init(bridge, { mode: "editor" });
    api.setAiConfig(aiConfig);

    await expect(
      api.runTurn({ agentId: "a1", message: "hi" }, onStatus),
    ).rejects.toThrow(/was not spawned/);
  });

  it("rejects a turn before init", async () => {
    const api = createRemoteEnvWorkerApi();
    api.spawnAgent({ agentId: "a1", tools: [], systemPrompt: "" });

    await expect(
      api.runTurn({ agentId: "a1", message: "hi" }, onStatus),
    ).rejects.toThrow(/not initialized/);
  });

  it("rejects a turn before the AI config is set", async () => {
    const api = createRemoteEnvWorkerApi();
    api.init(bridge, { mode: "editor" });
    api.spawnAgent({ agentId: "a1", tools: [], systemPrompt: "" });

    await expect(
      api.runTurn({ agentId: "a1", message: "hi" }, onStatus),
    ).rejects.toThrow(MISSING_AI_PROVIDER);
  });

  it("builds the turn session with the latest context set after init", async () => {
    const api = createRemoteEnvWorkerApi();
    api.init(bridge, { mode: "editor" });
    api.setAiConfig(aiConfig);
    api.spawnAgent({ agentId: "a1", tools: [], systemPrompt: "" });

    const nextContext: AgentContext = {
      mode: "runView",
      runId: "9",
      subgraphExecutionId: "exec-1",
    };
    api.setContext(nextContext);

    const { answer } = await api.runTurn(
      { agentId: "a1", message: "hi" },
      onStatus,
    );

    expect(answer).toBe("answer");
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "a1", context: nextContext }),
    );
  });

  it("forwards the resolved thinking depth to the agent spec", async () => {
    const api = createRemoteEnvWorkerApi();
    api.init(bridge, { mode: "editor" });
    api.setAiConfig(aiConfig);
    api.spawnAgent({
      agentId: "a1",
      tools: ["get_pipeline_state"],
      systemPrompt: "",
      thinkingDepth: "high",
    });

    await api.runTurn({ agentId: "a1", message: "hi" }, onStatus);

    expect(vi.mocked(buildRemoteEditorAgent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ thinkingDepth: "high" }),
    );
  });

  it("rejects overlapping turns for the same agent", async () => {
    const turn = defer<{ finalOutput: string }>();
    runAgent.mockReturnValueOnce(turn.promise);
    const api = createRemoteEnvWorkerApi();
    api.init(bridge, { mode: "editor" });
    api.setAiConfig(aiConfig);
    api.spawnAgent({ agentId: "a1", tools: [], systemPrompt: "" });

    const first = api.runTurn({ agentId: "a1", message: "one" }, onStatus);
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalledOnce());

    await expect(
      api.runTurn({ agentId: "a1", message: "two" }, onStatus),
    ).rejects.toThrow(/already has a turn/);
    turn.resolve({ finalOutput: "one" });
    await first;
  });

  it("does not let an old turn clear a respawned agent controller", async () => {
    const oldTurn = defer<{ finalOutput: string }>();
    const newTurn = defer<{ finalOutput: string }>();
    runAgent
      .mockReturnValueOnce(oldTurn.promise)
      .mockReturnValueOnce(newTurn.promise);
    const api = createRemoteEnvWorkerApi();
    api.init(bridge, { mode: "editor" });
    api.setAiConfig(aiConfig);
    api.spawnAgent({ agentId: "a1", tools: [], systemPrompt: "" });

    const oldRun = api.runTurn({ agentId: "a1", message: "old" }, onStatus);
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalledOnce());
    api.spawnAgent({ agentId: "a1", tools: [], systemPrompt: "" });
    const newRun = api.runTurn({ agentId: "a1", message: "new" }, onStatus);
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalledTimes(2));

    oldTurn.resolve({ finalOutput: "old" });
    await oldRun;
    api.abortAgent("a1");
    const newSignal = runAgent.mock.calls[1]?.[2]?.signal;
    expect(newSignal?.aborted).toBe(true);

    newTurn.resolve({ finalOutput: "new" });
    await newRun;
  });
});
