import { afterEach, expect, it, vi } from "vitest";

import {
  fetchJevModels,
  JevRequestError,
  requestJevSystemOne,
} from "@/services/jevService";
import type { ComponentRerankConfig } from "@/types/aiProvider";

const connection: ComponentRerankConfig = {
  provider: "jev",
  apiBase: "https://backend.example.com/prefix/native/jev/v1/",
  apiKey: "",
  credentials: "include",
  model: "jev-1.13.0",
};
const nativeResponse = {
  answers: {
    candidate_0: {
      type: "score",
      score: 2.8,
      confidence: 0.9,
      probabilities: { "0": 0, "1": 0, "2": 0.2, "3": 0.8 },
    },
  },
  model: "jev-1.13.0",
  usage: { input_tokens: 123, output_tokens: 7 },
};
afterEach(() => vi.unstubAllGlobals());

it.each(["jev-1.13.0", "jev-latest", "jev-preview"])(
  "sends the unchanged native payload and session credentials for %s",
  async (model) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(nativeResponse)));
    vi.stubGlobal("fetch", fetchMock);
    const payload = {
      model,
      state: {
        query: "read csv",
        candidates: { candidate_0: { id: "csv", name: "Read CSV" } },
      },
      questions: {
        candidate_0: {
          type: "score",
          instructions: "Evaluate this candidate",
          criteria: ["Unrelated", "Related", "Partial", "Direct"],
        },
      },
    };
    expect(await requestJevSystemOne(payload, connection)).toEqual(
      nativeResponse,
    );
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://backend.example.com/prefix/native/jev/v1/systemone",
    );
    expect(request).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
    });
    expect(Object.keys(request.headers)).toEqual(["content-type"]);
    expect(JSON.parse(request.body)).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

it("loads the native model catalog with a GET and no API key or authorization", async () => {
  const models = [
    {
      name: "jev-latest",
      description: "Latest model",
      release_date: "2026-09-10",
    },
    { name: "jev-preview" },
  ];
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ models })));
  vi.stubGlobal("fetch", fetchMock);
  expect(await fetchJevModels(connection)).toEqual(models);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://backend.example.com/prefix/native/jev/v1/models",
    expect.objectContaining({
      method: "GET",
      credentials: "include",
      headers: {},
    }),
  );
  expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("body");
});

it("keeps bearer-token authentication available for a direct provider", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ models: [] })));
  vi.stubGlobal("fetch", fetchMock);
  await fetchJevModels({
    ...connection,
    credentials: "omit",
    apiKey: "direct-key",
  });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    credentials: "omit",
    headers: { authorization: "Bearer direct-key" },
  });
});

it.each(["models", "systemone"])(
  "preserves same-origin session authentication for %s when credentials are unspecified",
  async (endpoint) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            endpoint === "models" ? { models: [] } : nativeResponse,
          ),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const options: ComponentRerankConfig = {
      provider: "jev",
      apiBase: `${window.location.origin}/ai/vendors/typesafe/v1`,
      apiKey: "",
      model: "jev-1.13.0",
    };
    if (endpoint === "models") {
      await fetchJevModels(options);
    } else {
      await requestJevSystemOne(
        { model: options.model, state: {}, questions: {} },
        options,
      );
    }
    const [url, init] = fetchMock.mock.calls[0];
    const request = new Request(url, init);
    expect(request.credentials).toBe("same-origin");
    expect(request.headers.has("authorization")).toBe(false);
  },
);

it.each([401, 403, 429, 500, 502, 504])(
  "surfaces HTTP %s and Retry-After without retrying or exposing response bodies",
  async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("private-upstream-body", {
        status,
        headers: { "Retry-After": "30" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const error = await fetchJevModels(connection).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(JevRequestError);
    expect(error).toMatchObject({
      status,
      retryAfter: "30",
      message: expect.stringContaining(`HTTP ${status}`),
    });
    expect((error as Error).message).toContain("Retry after 30 seconds");
    expect((error as Error).message).not.toContain("private-upstream-body");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

it("preserves an HTTP-date Retry-After", async () => {
  const retryAfter = "Wed, 30 Sep 2026 12:00:00 GMT";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("", {
        status: 429,
        headers: { "Retry-After": retryAfter },
      }),
    ),
  );
  await expect(fetchJevModels(connection)).rejects.toMatchObject({
    retryAfter,
    message: expect.stringContaining(retryAfter),
  });
});

it.each(["models", "systemone"])(
  "cancels a pending %s request using the caller's signal",
  async (endpoint) => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener(
              "abort",
              () => reject(init.signal.reason),
              { once: true },
            ),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const options = { ...connection, signal: controller.signal };
    const request =
      endpoint === "models"
        ? fetchJevModels(options)
        : requestJevSystemOne(
            { model: options.model, state: {}, questions: {} },
            options,
          );
    const assertion = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

it("rejects malformed catalogs without substituting another model", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "chat-model" }] })),
      ),
  );
  await expect(fetchJevModels(connection)).rejects.toThrow(
    "invalid model catalog",
  );
});

it("sanitizes non-JSON replies", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("private-invalid-json")),
  );
  await expect(fetchJevModels(connection)).rejects.toThrow(
    "Jev returned a non-JSON response.",
  );
});
