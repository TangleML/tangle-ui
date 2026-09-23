import type OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } = vi.hoisted(
  () => ({
    setDefaultOpenAIClient: vi.fn(),
    setOpenAIAPI: vi.fn(),
    setTracingDisabled: vi.fn(),
  }),
);

vi.mock("@openai/agents", () => ({
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
}));

import { getAgentModelConfig, ProxyClient } from "./config";

const BASE_CONFIG = {
  apiBase: "https://api.example.com/v1",
  apiKey: "sk-test",
  model: "",
};
const BACKEND_BASE = "https://backend.example.com/api/experimental/ai/v1";

describe("getAgentModelConfig", () => {
  it("omits the model when the configured model is blank", () => {
    expect(getAgentModelConfig(BASE_CONFIG)).toEqual({
      modelSettings: {
        providerData: { include: ["reasoning.encrypted_content"] },
      },
    });
  });

  it.each(["gpt-5.5", "gpt-5.6-sol", "gpt-6-sol", "gpt-6-astra"])(
    "uses %s with Responses reasoning continuity",
    (model) => {
      expect(getAgentModelConfig({ ...BASE_CONFIG, model })).toEqual({
        model,
        modelSettings: {
          providerData: { include: ["reasoning.encrypted_content"] },
        },
      });
    },
  );
});

describe("ProxyClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ id: "response-test", object: "response", output: [] }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses Responses and disables external tracing", () => {
    const client = new ProxyClient();
    client.ensureConfigured({ ...BASE_CONFIG, model: "gpt-5.5" });
    expect(setDefaultOpenAIClient).toHaveBeenCalledWith(client.openai);
    expect(setOpenAIAPI).toHaveBeenLastCalledWith("responses");
    expect(setTracingDisabled).toHaveBeenLastCalledWith(true);
  });

  it("reuses the SDK client when only the model changes", () => {
    const client = new ProxyClient();
    client.ensureConfigured({ ...BASE_CONFIG, model: "gpt-4o-mini" });
    const original = client.openai;
    client.ensureConfigured({ ...BASE_CONFIG, model: "gpt-5.5" });
    expect(client.openai).toBe(original);
    expect(setOpenAIAPI).toHaveBeenCalledTimes(1);
  });

  it("refreshes credentials on token rotation, logout, and switching provider mode", async () => {
    const client = new ProxyClient();
    const config = { ...BASE_CONFIG, apiBase: BACKEND_BASE, apiKey: "" };
    for (const token of ["first-token", "next-token", ""]) {
      client.ensureConfigured({ ...config, backendAuth: { token } });
      await client.openai.responses.create({
        model: "gpt-6-sol",
        input: "Hello",
      });
      const init = vi.mocked(fetch).mock.lastCall?.[1];
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        token ? `Bearer ${token}` : null,
      );
    }
    client.ensureConfigured({ ...config, apiKey: "custom-key" });
    await client.openai.responses.create({
      model: "gpt-6-sol",
      input: "Hello",
    });
    const init = vi.mocked(fetch).mock.lastCall?.[1];
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer custom-key",
    );
    expect(setDefaultOpenAIClient).toHaveBeenCalledTimes(4);
  });

  it("preserves request cancellation with backend authentication", async () => {
    const client = new ProxyClient();
    client.ensureConfigured({
      ...BASE_CONFIG,
      apiBase: BACKEND_BASE,
      backendAuth: { token: "backend-token" },
    });
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const pending = client.openai.responses
      .create(
        { model: "gpt-6-sol", input: "Hello" },
        { signal: controller.signal },
      )
      .asResponse();
    const assertion = expect(pending).rejects.toThrow(/aborted/i);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();
    await assertion;
    expect(vi.mocked(fetch).mock.lastCall?.[1]?.signal?.aborted).toBe(true);
  });

  it.each([
    {
      apiBase: BACKEND_BASE,
      apiKey: "",
      backendAuth: { token: "" },
      credentials: "include",
      authorization: null,
    },
    {
      apiBase: BASE_CONFIG.apiBase,
      apiKey: "",
      credentials: "omit",
      authorization: null,
    },
    {
      apiBase: BASE_CONFIG.apiBase,
      apiKey: "sk-test",
      credentials: "omit",
      authorization: "Bearer sk-test",
    },
    {
      apiBase: BACKEND_BASE,
      apiKey: "unused-provider-key",
      backendAuth: { token: "backend-token" },
      credentials: "include",
      authorization: "Bearer backend-token",
    },
    {
      apiBase: BACKEND_BASE,
      apiKey: "custom-key",
      credentials: "omit",
      authorization: "Bearer custom-key",
    },
  ])(
    "sends the unchanged Responses body to $apiBase with key '$apiKey'",
    async ({ apiBase, apiKey, backendAuth, credentials, authorization }) => {
      const client = new ProxyClient();
      client.ensureConfigured({
        apiBase: apiBase + "/",
        apiKey,
        backendAuth,
        model: "gpt-5.5",
      });
      const body: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
        model: "gpt-5.5",
        input: [{ role: "user", content: "Hello" }],
        instructions: "Keep it brief.",
        include: ["reasoning.encrypted_content"],
        store: false,
        stream: false,
        tools: [
          {
            type: "function",
            name: "example",
            description: "Example",
            parameters: {},
            strict: false,
          },
        ],
      };
      const response = await client.openai.responses.create(body);
      expect(response).toEqual({
        id: "response-test",
        object: "response",
        output: [],
        output_text: "",
      });
      const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
      expect(String(url)).toBe(apiBase + "/responses");
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBe(credentials);
      expect(new Headers(init?.headers).get("authorization")).toBe(
        authorization,
      );
      expect(JSON.parse(String(init?.body))).toEqual(body);
    },
  );

  it("preserves streamed Responses events", async () => {
    const event = {
      type: "response.output_text.delta",
      delta: "Hello",
      item_id: "item",
      output_index: 0,
      content_index: 0,
      sequence_number: 1,
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response("data: " + JSON.stringify(event) + "\n\ndata: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      }),
    );
    const client = new ProxyClient();
    client.ensureConfigured({
      ...BASE_CONFIG,
      apiBase: BACKEND_BASE,
      apiKey: "",
      backendAuth: { token: "" },
    });
    const stream = await client.openai.responses.create({
      model: "gpt-5.5",
      input: "Hello",
      stream: true,
    });
    const events = [];
    for await (const value of stream) events.push(value);
    expect(events).toEqual([event]);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toBe(BACKEND_BASE + "/responses");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "gpt-5.5",
      input: "Hello",
      stream: true,
    });
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("uses the backend route for embeddings and chat completions too", async () => {
    const client = new ProxyClient();
    client.ensureConfigured({
      ...BASE_CONFIG,
      apiBase: BACKEND_BASE,
      apiKey: "",
      backendAuth: { token: "backend-token" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ data: [{ index: 0, embedding: [1, 0] }] }),
    );
    const embeddingsBody = {
      model: "text-embedding-3-small",
      input: ["example"],
      encoding_format: "float",
    } satisfies OpenAI.Embeddings.EmbeddingCreateParams;
    await client.openai.embeddings.create(embeddingsBody);
    await client.openai.chat.completions.create({
      model: "gpt-5.5",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      BACKEND_BASE + "/embeddings",
    );
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)),
    ).toEqual(embeddingsBody);
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toBe(
      BACKEND_BASE + "/chat/completions",
    );
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer backend-token",
      );
    }
  });
});
