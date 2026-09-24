import { Agent } from "@openai/agents";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiProviderConfig } from "@/types/aiProvider";

import { getAgentModelConfig, ProxyClient } from "../config";
import { createSession } from "../session";
import { SkillsLoader } from "../skills/loader";
import { createDispatcherRuntime } from "./dispatcherRuntime";

function unexpectedBridgeCall(): never {
  throw new Error("This transport test should not invoke pipeline tools");
}

const bridge = {
  getPipelineState: unexpectedBridgeCall,
  getSubgraphState: unexpectedBridgeCall,
  setPipelineName: unexpectedBridgeCall,
  setPipelineDescription: unexpectedBridgeCall,
  setPipelineNotes: unexpectedBridgeCall,
  setPipelineTags: unexpectedBridgeCall,
  setRunNameTemplate: unexpectedBridgeCall,
  addTask: unexpectedBridgeCall,
  deleteTask: unexpectedBridgeCall,
  renameTask: unexpectedBridgeCall,
  setTaskColor: unexpectedBridgeCall,
  addInput: unexpectedBridgeCall,
  deleteInput: unexpectedBridgeCall,
  renameInput: unexpectedBridgeCall,
  updateInput: unexpectedBridgeCall,
  addOutput: unexpectedBridgeCall,
  deleteOutput: unexpectedBridgeCall,
  renameOutput: unexpectedBridgeCall,
  updateOutput: unexpectedBridgeCall,
  connectNodes: unexpectedBridgeCall,
  deleteEdge: unexpectedBridgeCall,
  setTaskArgument: unexpectedBridgeCall,
  createSubgraph: unexpectedBridgeCall,
  unpackSubgraph: unexpectedBridgeCall,
  addStickyNote: unexpectedBridgeCall,
  updateStickyNote: unexpectedBridgeCall,
  deleteStickyNote: unexpectedBridgeCall,
  moveNode: unexpectedBridgeCall,
  autoLayout: unexpectedBridgeCall,
  validatePipeline: unexpectedBridgeCall,
  searchComponents: unexpectedBridgeCall,
  submitPipelineRun: unexpectedBridgeCall,
  getRunDetails: unexpectedBridgeCall,
  getExecutionDetails: unexpectedBridgeCall,
  getExecutionState: unexpectedBridgeCall,
  getContainerState: unexpectedBridgeCall,
  getContainerLog: unexpectedBridgeCall,
  debugPipelineRun: unexpectedBridgeCall,
};

describe("dispatcher provider switching", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the current endpoint and credentials on every turn of an existing chat", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      const sequence = fetchMock.mock.calls.length;
      return new Response(
        JSON.stringify({
          id: `response-${sequence}`,
          output: [
            {
              id: `message-${sequence}`,
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                { type: "output_text", text: "Hello", annotations: [] },
              ],
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const personal: AiProviderConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-personal",
      model: "gpt-5.5",
    };
    const backend: AiProviderConfig = {
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-5.5",
      credentials: "include",
    };
    const configurations = [
      personal,
      backend,
      {
        ...backend,
        apiBase: "https://other.example.com/api/experimental/ai/v1",
      },
      personal,
    ];
    const proxyClient = new ProxyClient();
    const skillsLoader = new SkillsLoader();
    const dispatcher = createDispatcherRuntime((session) =>
      Promise.resolve(
        new Agent({
          name: "Transport test",
          ...getAgentModelConfig(session.aiConfig),
        }),
      ),
    );

    for (const [index, aiConfig] of configurations.entries()) {
      const session = createSession({
        threadId: "same-chat",
        proxyClient,
        skillsLoader,
        bridge,
        context: { mode: "editor" },
        aiConfig,
      });
      await expect(
        dispatcher.invoke({
          message: `Message ${index}`,
          threadId: session.threadId,
          aiConfig,
          session,
        }),
      ).resolves.toEqual({ answer: "Hello", threadId: "same-chat" });

      expect(fetchMock).toHaveBeenCalledTimes(index + 1);
      const [url, request] = fetchMock.mock.calls[index];
      expect(url).toBe(`${aiConfig.apiBase}/responses`);
      expect(request?.credentials).toBe(aiConfig.credentials);
      expect(new Headers(request?.headers).get("authorization")).toBe(
        aiConfig.apiKey ? `Bearer ${aiConfig.apiKey}` : null,
      );
      expect(String(request?.body)).toContain("Message 0");
      expect(String(request?.body)).toContain(`Message ${index}`);
    }
  });
});
