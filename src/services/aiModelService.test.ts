import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchCompatibleAiModelIds,
  resolveAiResponsesModel,
} from "./aiModelService";

const CONFIG = {
  apiBase: "https://backend.example.com/ai/v1/",
  apiKey: "",
  model: "gpt-6-sol",
  credentials: "include",
} as const;

function mockModels(data: unknown[]) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchCompatibleAiModelIds", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("excludes models that explicitly support only other API formats", async () => {
    mockModels([
      { id: "standard-model" },
      { id: "responses-model", endpoints: [{ api: "openai-responses" }] },
      { id: "path-model", endpoints: [{ path: "/v1/responses/" }] },
      { id: "chat-model", endpoints: [{ path: "/v1/chat/completions" }] },
      { id: "native-model", endpoints: [{ path: "/v1/messages" }] },
      { id: "unavailable-model", endpoints: [] },
      { id: "invalid-endpoint", endpoints: [null, { path: 42 }] },
      { id: "  " },
      { id: 42 },
      null,
    ]);

    await expect(fetchCompatibleAiModelIds(CONFIG)).resolves.toEqual([
      "standard-model",
      "responses-model",
      "path-model",
    ]);
  });

  it("uses the selected endpoint and browser authentication without a placeholder bearer token", async () => {
    const fetchMock = mockModels([]);
    const controller = new AbortController();
    await fetchCompatibleAiModelIds(CONFIG, controller.signal);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example.com/ai/v1/models",
      {
        credentials: "include",
        signal: controller.signal,
        headers: { accept: "application/json" },
      },
    );
  });

  it("uses a personal key for a custom provider", async () => {
    const fetchMock = mockModels([]);
    await fetchCompatibleAiModelIds({
      ...CONFIG,
      apiBase: "https://provider.example.com/v1",
      apiKey: " personal-key ",
      credentials: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.example.com/v1/models",
      expect.objectContaining({
        credentials: undefined,
        headers: {
          accept: "application/json",
          authorization: "Bearer personal-key",
        },
      }),
    );
  });

  it("rejects malformed catalogs instead of treating them as empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(fetchCompatibleAiModelIds(CONFIG)).rejects.toThrow(
      "invalid model list",
    );
  });

  it("reports the status without exposing a provider error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private upstream details", { status: 401 }),
        ),
    );
    await expect(fetchCompatibleAiModelIds(CONFIG)).rejects.toThrow(
      "Could not load available models (401).",
    );
  });
});

describe("resolveAiResponsesModel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses a compatible callable route when the default route uses another API", async () => {
    mockModels([
      {
        id: "reasoning-model",
        callable_id: "native-provider:reasoning-model",
        endpoints: [{ api: "native-messages" }, { api: "openai-responses" }],
        providers: [
          { route: "native-provider:reasoning-model", api_spec: "native" },
          {
            route: "responses-provider:reasoning-model",
            api_spec: "openai",
            endpoints: [{ api: "openai-responses" }],
          },
        ],
      },
    ]);

    await expect(
      resolveAiResponsesModel({ ...CONFIG, model: "reasoning-model" }),
    ).resolves.toBe("responses-provider:reasoning-model");
  });

  it("retains a working default alias instead of pinning a provider", async () => {
    mockModels([
      {
        id: "balanced-model",
        callable_id: "balanced-model",
        endpoints: [{ api: "openai-responses" }],
        providers: [{ route: "provider:balanced-model", api_spec: "openai" }],
      },
    ]);
    await expect(
      resolveAiResponsesModel({ ...CONFIG, model: "balanced-model" }),
    ).resolves.toBe("balanced-model");
  });

  it("uses the callable ID when a catalog explicitly supplies one", async () => {
    mockModels([{ id: "friendly-model", callable_id: "deployed-model" }]);
    await expect(
      resolveAiResponsesModel({ ...CONFIG, model: "friendly-model" }),
    ).resolves.toBe("deployed-model");
  });

  it("supports standard catalogs and forwards cancellation", async () => {
    const fetchMock = mockModels([{ id: CONFIG.model }]);
    const controller = new AbortController();
    await expect(
      resolveAiResponsesModel(CONFIG, controller.signal),
    ).resolves.toBe(CONFIG.model);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("keeps explicitly selected compatible routes available", async () => {
    const data = [
      {
        id: "friendly-model",
        callable_id: "provider:deployed-model",
        providers: [{ route: "provider:deployed-model", api_spec: "openai" }],
      },
    ];
    mockModels(data);
    await expect(fetchCompatibleAiModelIds(CONFIG)).resolves.toEqual([
      "friendly-model",
      "provider:deployed-model",
    ]);
    mockModels(data);
    await expect(
      resolveAiResponsesModel({ ...CONFIG, model: "provider:deployed-model" }),
    ).resolves.toBe("provider:deployed-model");
  });

  it("does not select a route explicitly limited to Chat Completions", async () => {
    mockModels([
      {
        id: "reasoning-model",
        callable_id: "chat-provider:model",
        endpoints: [{ api: "openai-responses" }],
        providers: [
          {
            route: "chat-provider:model",
            api_spec: "openai",
            endpoints: [{ api: "openai-completions" }],
          },
          {
            route: "responses-provider:model",
            api_spec: "openai",
            endpoints: [{ api: "openai-responses" }],
          },
        ],
      },
    ]);
    await expect(
      resolveAiResponsesModel({ ...CONFIG, model: "reasoning-model" }),
    ).resolves.toBe("responses-provider:model");
  });

  it("hides a native default when an alternative only advertises OpenAI format", async () => {
    mockModels([
      {
        id: "reasoning-model",
        callable_id: "native-provider:model",
        endpoints: [{ api: "openai-responses" }],
        providers: [
          { route: "native-provider:model", api_spec: "native" },
          { route: "other-provider:model", api_spec: "openai" },
          { route: " ", api_spec: "openai" },
          null,
        ],
      },
    ]);
    await expect(fetchCompatibleAiModelIds(CONFIG)).resolves.toEqual([]);
  });

  it("rejects an unavailable saved model before sending inference", async () => {
    const fetchMock = mockModels([]);
    await expect(resolveAiResponsesModel(CONFIG)).rejects.toThrow(
      "Choose another model",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://backend.example.com/ai/v1/models",
    );
  });
});
