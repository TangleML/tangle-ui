import { Agent, OpenAIProvider, run, Runner } from "@openai/agents";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAiResponsesModel } from "@/services/aiModelService";

import { getAgentModelConfig, ProxyClient } from "./config";

describe("AI client transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends proxy requests with browser credentials and without an AI bearer token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "test-response", output: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProxyClient();
    client.ensureConfigured({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-5.5",
      credentials: "include",
    });

    await client.openai.responses.create({ model: "gpt-5.5", input: "Hello" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example.com/api/experimental/ai/v1/responses",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).has("authorization"),
    ).toBe(false);
  });

  it("uses the personal key again after switching back to a custom provider", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ id: "test-response", output: [] }), {
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProxyClient();
    client.ensureConfigured({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-5.5",
      credentials: "include",
    });
    client.ensureConfigured({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-personal",
      model: "gpt-5.5",
    });

    await client.openai.responses.create({ model: "gpt-5.5", input: "Hello" });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/v1/responses",
    );
    expect(fetchMock.mock.calls[0][1]?.credentials).not.toBe("include");
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization"),
    ).toBe("Bearer sk-personal");
  });

  it.each(["", "gpt-6-sol", "custom-reasoning-model"])(
    "uses the configured model selection %j in an actual agent request",
    async (model) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "test-response",
            output: [
              {
                id: "test-message",
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
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const config = {
        apiBase: "https://backend.example.com/api/experimental/ai/v1",
        apiKey: "",
        model,
        reasoningEffort: "max",
        credentials: "include",
      } satisfies Parameters<ProxyClient["ensureConfigured"]>[0];
      const client = new ProxyClient();
      client.ensureConfigured(config);

      const result = await run(
        new Agent({ name: "Test agent", ...getAgentModelConfig(config) }),
        "Hello",
      );

      expect(result.finalOutput).toBe("Hello");
      const request = fetchMock.mock.calls[0][1];
      const body = JSON.parse(String(request?.body));
      expect(body.model).toBe(model || "gpt-6-sol");
      expect(body.reasoning).toMatchObject({ effort: "max" });
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://backend.example.com/api/experimental/ai/v1/responses",
      );
      expect(request?.credentials).toBe("include");
      expect(new Headers(request?.headers).has("authorization")).toBe(false);
    },
  );

  it("sends a catalog-resolved callable ID through the Responses SDK", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "custom-reasoning-model",
                callable_id: "native-provider:model",
                endpoints: [{ api: "openai-responses" }],
                providers: [
                  { route: "native-provider:model", api_spec: "native" },
                  {
                    route: "responses-provider:model",
                    api_spec: "openai",
                    endpoints: [{ api: "openai-responses" }],
                  },
                ],
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "test-response",
            output: [
              {
                id: "test-message",
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
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const config = {
      apiBase: "https://backend.example.com/ai/v1",
      apiKey: "",
      model: "custom-reasoning-model",
      reasoningEffort: "max",
      credentials: "include",
    } satisfies Parameters<ProxyClient["ensureConfigured"]>[0];
    const model = await resolveAiResponsesModel(config);
    const client = new ProxyClient();
    client.ensureConfigured(config);
    const runner = new Runner({
      modelProvider: new OpenAIProvider({
        openAIClient: client.openai,
        useResponses: true,
      }),
      tracingDisabled: true,
    });
    const result = await runner.run(
      new Agent({
        name: "Test agent",
        ...getAgentModelConfig({ ...config, model }),
      }),
      "Hello",
    );

    expect(result.finalOutput).toBe("Hello");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://backend.example.com/ai/v1/models",
      "https://backend.example.com/ai/v1/responses",
    ]);
    const request = fetchMock.mock.calls[1][1];
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: "responses-provider:model",
      reasoning: { effort: "max" },
    });
    expect(request?.credentials).toBe("include");
    expect(new Headers(request?.headers).has("authorization")).toBe(false);
  });
});
