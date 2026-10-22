import { describe, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";

const askMock = vi.hoisted(() => vi.fn());
const terminateMock = vi.hoisted(() => vi.fn());

vi.mock("./agentClient", () => {
  class FakeAgentClient {
    ask = askMock;
    terminate = terminateMock;
  }

  return { AgentClient: FakeAgentClient };
});

const { AgentThread } = await import("./agentThread");

const aiConfig = {
  apiBase: "https://api.example.com/v1",
  apiKey: "sk-test",
  model: "gpt-5.5",
};

function createThread(): InstanceType<typeof AgentThread> {
  return new AgentThread({
    createWorker: () => ({ terminate: vi.fn() }) as unknown as Worker,
    context: { mode: "editor" },
  });
}

describe("AgentThread", () => {
  it("renders provider conversation-state errors in the chat", async () => {
    askMock.mockRejectedValueOnce(
      new Error(
        "400 Item 'fc_123' of type 'function_call' was provided without its required 'reasoning' item: 'rs_123'.",
      ),
    );
    const thread = createThread();

    await thread.sendMessage("Fix validation", {
      createBridge: () => ({}) as ToolBridgeApi,
      aiConfig,
    });

    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[0]).toMatchObject({
      role: "user",
      content: "Fix validation",
    });
    expect(thread.messages[1]).toMatchObject({
      role: "assistant",
      content:
        "I ran into a model conversation-state error while processing that request. Please try again in this chat, or start a new chat if it keeps happening.",
    });
    expect(thread.isPending).toBe(false);
  });

  it("scopes each turn to its abort signal while keeping the conversation", async () => {
    askMock.mockClear();
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    askMock.mockImplementationOnce(
      async (_deps: unknown, _options: unknown, signal: AbortSignal) => {
        await pending;
        signal.throwIfAborted();
      },
    );
    const thread = createThread();
    const createBridge = vi.fn((_signal: AbortSignal) => ({}) as ToolBridgeApi);
    const asking = thread.sendMessage("Edit this pipeline", {
      createBridge,
      aiConfig,
    });
    const firstSignal = createBridge.mock.calls[0][0];
    expect(firstSignal.aborted).toBe(false);
    thread.abort();
    expect(firstSignal.aborted).toBe(true);
    expect(thread.isPending).toBe(true);
    await thread.sendMessage("Overlapping turn", { createBridge, aiConfig });
    expect(askMock).toHaveBeenCalledTimes(1);
    finish();
    await asking;

    expect(thread.messages[1].content).toBe(
      "The request was stopped. Send a new message to continue.",
    );
    askMock.mockResolvedValueOnce({
      answer: "Ready",
      componentReferences: {},
    });
    await thread.sendMessage("Continue here", { createBridge, aiConfig });
    const nextSignal = createBridge.mock.calls[1][0];
    expect(nextSignal).not.toBe(firstSignal);
    expect(nextSignal.aborted).toBe(false);
    expect(thread.messages.map((message) => message.content)).toEqual([
      "Edit this pipeline",
      "The request was stopped. Send a new message to continue.",
      "Continue here",
      "Ready",
    ]);
    expect(thread.isPending).toBe(false);
  });
});
