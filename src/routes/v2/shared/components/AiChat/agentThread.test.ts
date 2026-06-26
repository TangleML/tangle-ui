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
      bridge: {} as ToolBridgeApi,
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
});
