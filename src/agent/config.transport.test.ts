import { Agent, run } from "@openai/agents";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it.each(["", "gpt-5.5"])(
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
      if (model) {
        expect(body.model).toBe(model);
      } else {
        expect(body).not.toHaveProperty("model");
      }
      expect(request?.credentials).toBe("include");
      expect(new Headers(request?.headers).has("authorization")).toBe(false);
    },
  );
});
