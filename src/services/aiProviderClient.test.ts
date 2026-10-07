import {
  Agent,
  MemorySession,
  OpenAIProvider,
  Runner,
  tool,
} from "@openai/agents";
import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AI_CONFIG } from "@/config/aiConfig";
import type { ComponentReference } from "@/utils/componentSpec";

import { aiProviderFetch } from "./aiProviderClient";
import {
  generateComponentAiDescription,
  rerankComponentsByNaturalLanguage,
} from "./naturalLanguageComponentSearchService";

vi.mock("@/utils/getComponentName", () => ({
  getComponentName: (component: ComponentReference) =>
    component.spec?.name ?? "Component",
}));

const endpoint = "https://api.example.com/v1/responses";
const nativeMessage = {
  id: "msg_native",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-4-6",
  content: [{ type: "text", text: "Hello" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 3 },
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

function request(body: Record<string, unknown>, init?: RequestInit) {
  return aiProviderFetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer key",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      input: "Hello",
      ...body,
    }),
    ...init,
  });
}

const fetchMock = vi.fn<typeof fetch>();

function sentBody(index = 0) {
  return JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body));
}

describe("aiProviderFetch", () => {
  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockImplementation(async () => jsonResponse(nativeMessage));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["gpt-5.2", "", "gemini-flash-latest"])(
    "passes through model %j without changing the request or response",
    async (model) => {
      const upstream = jsonResponse({ output_text: "Hello" });
      fetchMock.mockResolvedValue(upstream);
      const init = {
        method: "POST",
        body: JSON.stringify({ model, input: "Hi" }),
      };
      expect(await aiProviderFetch(endpoint, init)).toBe(upstream);
      expect(fetchMock).toHaveBeenCalledWith(endpoint, init);
    },
  );

  it.each(["embeddings", "models"])(
    "leaves %s requests untouched even with a Claude model",
    async (path) => {
      const url = `https://api.example.com/v1/${path}`;
      const init = {
        method: "POST",
        body: JSON.stringify({ model: "claude-test" }),
      };
      await aiProviderFetch(url, init);
      expect(fetchMock).toHaveBeenCalledWith(url, init);
    },
  );

  it("uses native direct authentication and accepts a Request input", async () => {
    await aiProviderFetch(
      new Request(`${endpoint}?trace=1`, {
        method: "POST",
        headers: {
          authorization: "Bearer direct-key",
          "x-request-id": "trace",
          "Anthropic-Beta": "example-beta",
          "Anthropic-Version": "outdated",
          "Content-Type": "text/plain",
          "Content-Length": "1",
          "OpenAI-Beta": "responses-test",
          "OpenAI-Organization": "example-org",
          "OpenAI-Project": "example-project",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-6",
          input: "Hi",
        }),
      }),
    );
    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(String(url)).toBe("https://api.example.com/v1/messages?trace=1");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-api-key")).toBe("direct-key");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe(
      "true",
    );
    expect(headers.get("x-request-id")).toBe("trace");
    expect(headers.get("anthropic-beta")).toBe("example-beta");
    expect(headers.get("content-type")).toBe("application/json");
    for (const name of [
      "content-length",
      "openai-beta",
      "openai-organization",
      "openai-project",
    ]) {
      expect(headers.has(name)).toBe(false);
    }
    expect(sentBody().model).toBe("claude-sonnet-4-6");
    expect(sentBody().max_tokens).toBe(8192);
  });

  it("routes cookie-authenticated requests through a sibling native endpoint", async () => {
    const controller = new AbortController();
    await aiProviderFetch(
      "https://backend.example.com/ai/v1/responses?trace=1",
      {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer proxy-key",
          "openai-project": "example-project",
        },
        body: JSON.stringify({ model: "claude-sonnet-4-6", input: "Hi" }),
      },
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://backend.example.com/ai/anthropic/v1/messages?trace=1",
    );
    expect(init?.credentials).toBe("include");
    expect(init?.signal).toBe(controller.signal);
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer proxy-key");
    expect(headers.has("openai-project")).toBe(false);
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.has("x-api-key")).toBe(false);
    expect(headers.has("anthropic-dangerous-direct-browser-access")).toBe(
      false,
    );
  });

  it("preserves messages and tool results while omitting opaque reasoning", async () => {
    await request({
      instructions: "Use tools when needed.",
      input: [
        { role: "system", content: "Be concise." },
        { role: "developer", content: "Use metric units." },
        { role: "user", content: [{ type: "input_text", text: "Find it" }] },
        { type: "reasoning", encrypted_content: "opaque", summary: [] },
        {
          type: "function_call",
          call_id: "call:one",
          name: "lookup",
          arguments: '{"q":"item"}',
        },
        {
          type: "function_call_output",
          call_id: "call:one",
          output: "Found it",
        },
        {
          role: "assistant",
          content: [{ type: "output_text", text: "Here it is" }],
        },
        { role: "user", content: "Tell me more" },
      ],
      max_output_tokens: 256,
      reasoning: { effort: "high" },
      include: ["reasoning.encrypted_content"],
      temperature: 0.7,
    });
    const body = sentBody();
    expect(JSON.stringify(body.system)).toContain("Use tools when needed.");
    expect(JSON.stringify(body.system)).toContain("Be concise.");
    expect(JSON.stringify(body.system)).toContain("Use metric units.");
    const blocks = body.messages.flatMap(
      (message: { content: unknown[] }) => message.content,
    );
    const call = blocks.find(
      (block: { type: string }) => block.type === "tool_use",
    );
    const result = blocks.find(
      (block: { type: string }) => block.type === "tool_result",
    );
    expect(call).toMatchObject({ name: "lookup", input: { q: "item" } });
    expect(call.id).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(result).toMatchObject({ tool_use_id: call.id, content: "Found it" });
    expect(JSON.stringify(body)).toContain("Tell me more");
    expect(body.max_tokens).toBe(256);
    for (const field of ["reasoning", "include", "temperature"]) {
      expect(body).not.toHaveProperty(field);
    }
    expect(JSON.stringify(body)).not.toContain("opaque");
  });

  it.each([
    ["auto", { type: "auto" }],
    ["required", { type: "any" }],
    ["none", { type: "none" }],
    [
      { type: "function", name: "lookup" },
      { type: "tool", name: "lookup" },
    ],
  ])("converts function tools and tool choice %j", async (choice, expected) => {
    await request({
      tools: [
        {
          type: "function",
          name: "lookup",
          description: "Find items",
          parameters: { type: "object" },
          strict: true,
        },
      ],
      tool_choice: choice,
    });
    expect(sentBody().tools).toEqual([
      {
        name: "lookup",
        description: "Find items",
        input_schema: { type: "object" },
      },
    ]);
    expect(sentBody().tool_choice).toEqual(expected);
  });

  it("preserves structured output schemas and requests JSON for json_object", async () => {
    const schema = {
      type: "object",
      properties: { answer: { type: "string" } },
      required: ["answer"],
      additionalProperties: false,
    };
    await request({
      text: {
        format: { type: "json_schema", name: "answer", strict: true, schema },
      },
    });
    expect(sentBody().output_config).toEqual({
      format: { type: "json_schema", schema },
    });
    await request({ text: { format: { type: "json_object" } } });
    expect(JSON.stringify(sentBody(1).system)).toMatch(/json/i);
  });

  it("returns Responses text and tool items with complete token accounting", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          ...nativeMessage,
          content: [
            { type: "text", text: "Checking" },
            {
              type: "tool_use",
              id: "toolu_1",
              name: "lookup",
              input: { q: "item" },
            },
          ],
          stop_reason: "tool_use",
          usage: {
            input_tokens: 10,
            output_tokens: 3,
            cache_creation_input_tokens: 20,
            cache_read_input_tokens: 30,
          },
        },
        {
          headers: {
            "x-request-id": "trace",
            "content-length": "1",
            "content-encoding": "gzip",
          },
        },
      ),
    );
    const response = await request({});
    const body = await response.json();
    expect(body.output_text).toBe("Checking");
    expect(body.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "message",
          role: "assistant",
          content: [
            expect.objectContaining({ type: "output_text", text: "Checking" }),
          ],
        }),
        expect.objectContaining({
          type: "function_call",
          call_id: "toolu_1",
          name: "lookup",
          arguments: '{"q":"item"}',
        }),
      ]),
    );
    expect(body.usage).toMatchObject({
      input_tokens: 60,
      output_tokens: 3,
      total_tokens: 63,
      input_tokens_details: { cached_tokens: 30 },
    });
    expect(response.headers.get("x-request-id")).toBe("trace");
    expect(response.headers.has("content-length")).toBe(false);
    expect(response.headers.has("content-encoding")).toBe(false);
  });

  it("reports a token-limited native response as incomplete", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...nativeMessage, stop_reason: "max_tokens" }),
    );
    expect(await (await request({})).json()).toMatchObject({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    });
  });

  it.each([
    "claude-opus-5",
    "claude-opus-5-5",
    "claude-sonnet-5-5",
    "claude-fable-5-1",
    "claude-mythos-preview",
    "anthropic/claude-sonnet-5-5",
  ])(
    "allows room for thinking when %s has a small requested output budget",
    async (model) => {
      await request({ model, max_output_tokens: 256 });
      expect(sentBody().max_tokens).toBeGreaterThanOrEqual(4096);
    },
  );

  it.each(["custom-reasoner", "anthropic/claude-opus-5-5"])(
    "uses the configured provider and token limit for %s",
    async (model) => {
      AI_CONFIG.models.push({
        id: model,
        provider: "anthropic",
        label: "Custom reasoner",
        description: "Custom model",
        minimumOutputTokens: 1024,
      });
      try {
        await request({ model, max_output_tokens: 256 });
        expect(String(fetchMock.mock.calls[0][0])).toBe(
          "https://api.example.com/v1/messages",
        );
        expect(sentBody().max_tokens).toBe(1024);
      } finally {
        AI_CONFIG.models.pop();
      }
    },
  );

  it.each(["claude-haiku-4-5", "claude-opus-4-8", "claude-sonnet-4-6"])(
    "preserves the requested small output budget for %s",
    async (model) => {
      await request({ model, max_output_tokens: 256 });
      expect(sentBody().max_tokens).toBe(256);
    },
  );

  it("rejects a truncated tool call instead of returning an executable tool item", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...nativeMessage,
        content: [
          { type: "tool_use", id: "toolu_partial", name: "lookup", input: {} },
        ],
        stop_reason: "max_tokens",
      }),
    );
    await expect(request({})).rejects.toThrow(/token budget/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { type: "text", text: "Incomplete answer" },
    { type: "tool_use", id: "toolu_partial", name: "lookup", input: {} },
  ])("rejects context-truncated $type responses", async (block) => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...nativeMessage,
        content: [block],
        stop_reason: "model_context_window_exceeded",
      }),
    );
    await expect(request({})).rejects.toThrow(/context window/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      type: "thinking",
      thinking: "Checking the request",
      signature: "signed-native-thinking",
    },
    { type: "redacted_thinking", data: "redacted-native-thinking" },
  ])(
    "restores native %s only within the current tool loop and Claude model",
    async (block) => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          ...nativeMessage,
          content: [
            block,
            ...nativeMessage.content,
            {
              type: "tool_use",
              id: "toolu_1",
              name: "lookup",
              input: { q: "item" },
            },
          ],
          stop_reason: "tool_use",
        }),
      );
      const converted = await (await request({})).json();
      const input = [
        { role: "user", content: "First question" },
        ...converted.output,
        {
          type: "function_call_output",
          call_id: "toolu_1",
          output: "Found it",
        },
      ];
      await request({ input });
      expect(
        sentBody(1).messages.find(
          (message: { role: string }) => message.role === "assistant",
        ).content[0],
      ).toEqual(block);
      await request({ model: "claude-haiku-4-5", input });
      const otherModel = JSON.stringify(sentBody(2).messages);
      expect(otherModel).toContain("Hello");
      expect(otherModel).not.toContain("native-thinking");
      expect(otherModel).not.toContain("tangle-anthropic:");
      await request({
        input: [...input, { role: "user", content: "New question" }],
        instructions: "Use the updated instructions.",
      });
      const newTurn = JSON.stringify(sentBody(3).messages);
      expect(newTurn).toContain("Hello");
      expect(newTurn).toContain("Found it");
      expect(newTurn).toContain("New question");
      expect(newTurn).not.toContain("native-thinking");
      expect(newTurn).not.toContain("tangle-anthropic:");
    },
  );

  it("generates component descriptions through native Claude Messages", async () => {
    const description = "Sorts the input rows.";
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...nativeMessage,
        content: [{ type: "text", text: JSON.stringify({ description }) }],
      }),
    );
    const result = await generateComponentAiDescription(
      {
        spec: {
          name: "Sort rows",
          inputs: [{ name: "rows", type: "Dataset" }],
          outputs: [{ name: "sorted", type: "Dataset" }],
          implementation: { container: { image: "example/sorter" } },
        },
      },
      {
        apiBase: "https://api.example.com/v1",
        apiKey: "direct-key",
        model: "claude-sonnet-4-6",
      },
    );
    expect(result.description).toBe(description);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/v1/messages",
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-api-key"),
    ).toBe("direct-key");
    expect(JSON.stringify(sentBody().messages)).toContain("Sort rows");
    expect(JSON.stringify(sentBody().messages)).toContain("example/sorter");
    expect(sentBody().system).toContain("single JSON object");
  });

  it("reranks component search results through cookie-authenticated Claude Messages", async () => {
    const matches = [
      { id: "sorter", score: 0.91, reason: "Sorts the requested rows." },
    ];
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...nativeMessage,
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: JSON.stringify({ matches }) }],
      }),
    );
    const result = await rerankComponentsByNaturalLanguage(
      "sort rows",
      [{ id: "sorter", name: "Sort rows", description: "Sort a dataset" }],
      {
        apiBase: "https://backend.example.com/ai/v1",
        apiKey: "",
        model: "claude-sonnet-5-5",
        credentials: "include",
      },
    );
    expect(result.matches).toEqual(matches);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://backend.example.com/ai/anthropic/v1/messages",
    );
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).has("x-api-key")).toBe(false);
    expect(JSON.stringify(sentBody().messages)).toContain("sorter");
    expect(JSON.stringify(sentBody().messages)).toContain("sort rows");
    expect(sentBody().system).toContain("reranker");
    expect(sentBody().max_tokens).toBeGreaterThanOrEqual(4096);
  });

  it("returns upstream errors with their status, headers, and payload intact", async () => {
    const upstream = jsonResponse(
      { error: { type: "rate_limit_error", message: "Try later" } },
      { status: 429, headers: { "retry-after": "2" } },
    );
    fetchMock.mockResolvedValue(upstream);
    expect(await request({})).toBe(upstream);
    expect(await upstream.json()).toEqual({
      error: { type: "rate_limit_error", message: "Try later" },
    });
  });

  it("preserves fetch cancellation", async () => {
    const controller = new AbortController();
    const error = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(error);
    await expect(request({}, { signal: controller.signal })).rejects.toBe(
      error,
    );
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it.each([
    { stream: true },
    { previous_response_id: "resp_previous" },
    { tools: [{ type: "web_search" }] },
    {
      input: [
        { role: "user", content: [{ type: "input_file", file_id: "file_1" }] },
      ],
    },
    {
      input: [
        {
          type: "function_call",
          call_id: "call_1",
          name: "lookup",
          arguments: "not-json",
        },
      ],
    },
  ])(
    "rejects unsupported or invalid input without sending it: %j",
    async (body) => {
      await expect(request(body)).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("keeps one SDK chat and its tool history across OpenAI, Claude, and OpenAI", async () => {
    const openAIText = (id: string, text: string) => ({
      id,
      object: "response",
      status: "completed",
      output: [
        {
          id: `msg_${id}`,
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
    });
    const thinking = {
      type: "thinking",
      thinking: "I should look this up",
      signature: "signed-native-thinking",
    };
    const replies = [
      {
        id: "resp_1",
        output: [
          {
            type: "reasoning",
            id: "rs_1",
            encrypted_content: "opaque",
            summary: [],
          },
          {
            type: "function_call",
            id: "fc_1",
            call_id: "call:one",
            name: "lookup",
            arguments: '{"q":"first"}',
          },
        ],
      },
      openAIText("resp_2", "First answer"),
      {
        ...nativeMessage,
        content: [
          thinking,
          {
            type: "tool_use",
            id: "toolu_two",
            name: "lookup",
            input: { q: "second" },
          },
        ],
        stop_reason: "tool_use",
      },
      {
        ...nativeMessage,
        id: "msg_final",
        content: [{ type: "text", text: "Second answer" }],
      },
      openAIText("resp_5", "Third answer"),
    ];
    fetchMock.mockImplementation(async () =>
      jsonResponse(replies[fetchMock.mock.calls.length - 1]),
    );
    const lookup = tool({
      name: "lookup",
      description: "Find an item",
      parameters: z.object({ q: z.string() }),
      execute: ({ q }) => `Found ${q}`,
    });
    const client = new OpenAI({
      baseURL: "https://api.example.com/v1",
      apiKey: "key",
      dangerouslyAllowBrowser: true,
      fetch: aiProviderFetch,
    });
    const runner = new Runner({
      modelProvider: new OpenAIProvider({
        openAIClient: client,
        useResponses: true,
      }),
      tracingDisabled: true,
    });
    const session = new MemorySession({ sessionId: "one-chat" });
    for (const [model, prompt, answer] of [
      ["gpt-5.2", "First question", "First answer"],
      ["claude-sonnet-4-6", "Second question", "Second answer"],
      ["gpt-5.2", "Third question", "Third answer"],
    ]) {
      const result = await runner.run(
        new Agent({ name: "Assistant", model, tools: [lookup] }),
        prompt,
        { session },
      );
      expect(result.finalOutput).toBe(answer);
    }
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[2][0])).toBe(
      "https://api.example.com/v1/messages",
    );
    expect(JSON.stringify(sentBody(2).messages)).toContain("Found first");
    expect(JSON.stringify(sentBody(2).messages)).toContain("First answer");
    expect(JSON.stringify(sentBody(3).messages)).toContain("Found second");
    const nativeContinuation = sentBody(3).messages.findLast(
      (message: { role: string }) => message.role === "assistant",
    );
    expect(nativeContinuation.content[0]).toEqual(thinking);
    expect(nativeContinuation.content[1]).toMatchObject({
      type: "tool_use",
      id: "toolu_two",
    });
    expect(String(fetchMock.mock.calls[4][0])).toBe(endpoint);
    const finalHistory = JSON.stringify(sentBody(4).input);
    for (const text of [
      "First question",
      "Second question",
      "Third question",
      "Found first",
      "Found second",
      "toolu_two",
    ]) {
      expect(finalHistory).toContain(text);
    }
    expect(finalHistory).toContain("opaque");
    expect(finalHistory).not.toContain("signed-native-thinking");
    expect(finalHistory).not.toContain("tangle-anthropic:");
    expect((await session.getItems()).length).toBeGreaterThan(3);
  });

  it("includes every native text block in the SDK's final answer", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...nativeMessage,
        content: [
          { type: "text", text: "First part. " },
          { type: "text", text: "Second part." },
        ],
      }),
    );
    const client = new OpenAI({
      baseURL: "https://api.example.com/v1",
      apiKey: "key",
      dangerouslyAllowBrowser: true,
      fetch: aiProviderFetch,
    });
    const runner = new Runner({
      modelProvider: new OpenAIProvider({
        openAIClient: client,
        useResponses: true,
      }),
      tracingDisabled: true,
    });
    const result = await runner.run(
      new Agent({ name: "Assistant", model: "claude-sonnet-4-6" }),
      "Hello",
    );
    expect(result.finalOutput).toBe("First part. Second part.");
  });
});
