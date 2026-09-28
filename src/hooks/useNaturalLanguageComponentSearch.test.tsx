import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  AI_USE_OWN_KEY_STORAGE_KEY,
  useAiProviderSettings,
} from "@/hooks/useAiProviderSettings";
import { useNaturalLanguageComponentRerank } from "@/hooks/useNaturalLanguageComponentSearch";
import { fetchJevModels } from "@/services/jevService";

const backend = vi.hoisted(() => ({
  backendUrl: "https://backend.example.com",
}));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: () => backend }));

const mockFetch = vi.fn();
let client: QueryClient;
beforeEach(() => {
  window.localStorage.clear();
  backend.backendUrl = "https://backend.example.com";
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  client = new QueryClient({ defaultOptions: { mutations: { retry: 3 } } });
});
afterEach(() => {
  client.clear();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderSearch() {
  return renderHook(
    () => ({
      settings: useAiProviderSettings(),
      search: useNaturalLanguageComponentRerank(),
    }),
    { wrapper },
  );
}

const SEARCH = {
  query: "upload",
  candidates: [{ id: "upload", name: "Upload", description: "Upload a file" }],
  scoreAllCandidates: true,
};
const NATIVE_RESPONSE = {
  model: "jev-1.13.0",
  usage: { input_tokens: 42 },
  answers: {
    candidate_0: {
      type: "score",
      score: 3,
      confidence: 0.9,
      probabilities: { "0": 0, "1": 0, "2": 0, "3": 1 },
    },
  },
};

it.each(["proxy-key", ""])(
  "automatically uses the shared environment proxy for native ranking and models (key: %s)",
  async (apiKey) => {
    vi.stubEnv("VITE_OPENAI_API_BASE", "https://proxy.example.com/prefix/v1/");
    vi.stubEnv("VITE_OPENAI_API_KEY", apiKey);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(NATIVE_RESPONSE)),
    );
    const { result } = renderSearch();
    expect(result.current.search.isConfigured).toBe(true);
    expect(result.current.search.modelLabel).toBe("Jev (jev-1.13.0)");
    await act(async () => {
      await result.current.search.mutateAsync(SEARCH);
    });
    await waitFor(() =>
      expect(result.current.search.data?.matches).toEqual([
        { id: "upload", score: 1, confidence: 0.9, matchStrength: "strong" },
      ]),
    );
    expect(result.current.search.data?.providerResponses).toEqual([
      NATIVE_RESPONSE,
    ]);
    const [url, request] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://proxy.example.com/prefix/vendors/typesafe/v1/systemone",
    );
    expect(request).toMatchObject({
      method: "POST",
      credentials: apiKey ? "omit" : "include",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
    });
    expect(Object.keys(request.headers)).toEqual(
      apiKey ? ["content-type", "authorization"] : ["content-type"],
    );
    const payload = JSON.parse(request.body);
    expect(Object.keys(payload).sort()).toEqual([
      "model",
      "questions",
      "state",
    ]);
    expect(payload.model).toBe("jev-1.13.0");
    expect(payload.questions.candidate_0.type).toBe("score");
    const models = [{ name: "jev-latest", description: "Latest stable model" }];
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ models })));
    await expect(
      fetchJevModels(result.current.settings.rerankConfig),
    ).resolves.toEqual(models);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://proxy.example.com/prefix/vendors/typesafe/v1/models",
      expect.objectContaining({
        method: "GET",
        credentials: apiKey ? "omit" : "include",
        headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      }),
    );
  },
);

function pendingRequest() {
  let signal: AbortSignal | undefined;
  mockFetch.mockImplementation((_url, request) => {
    signal = request.signal;
    return new Promise((_resolve, reject) =>
      signal?.addEventListener("abort", () => reject(signal?.reason), {
        once: true,
      }),
    );
  });
  return () => signal;
}

it("cancels a pending ranking and clears stale results when the shared backend changes", async () => {
  window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
  const getSignal = pendingRequest();
  const { result, rerender } = renderSearch();
  act(() => result.current.search.mutate(SEARCH));
  await waitFor(() => expect(getSignal()).toBeDefined());
  expect(mockFetch.mock.calls[0][0]).toBe(
    "https://backend.example.com/api/experimental/ai/vendors/typesafe/v1/systemone",
  );
  backend.backendUrl = "https://new.example.com";
  rerender();
  expect(getSignal()?.aborted).toBe(true);
  await waitFor(() => expect(result.current.search.isPending).toBe(false));
  expect(result.current.search.data).toBeUndefined();
  backend.backendUrl = "";
  rerender();
  expect(result.current.search.isConfigured).toBe(false);
});

it("cancels on a new search and on unmount", async () => {
  vi.stubEnv("VITE_OPENAI_API_BASE", "https://proxy.example.com/v1");
  const getSignal = pendingRequest();
  const { result, unmount } = renderSearch();
  act(() => result.current.search.mutate(SEARCH));
  await waitFor(() => expect(getSignal()).toBeDefined());
  const firstSignal = getSignal();
  act(() => result.current.search.mutate({ ...SEARCH, query: "download" }));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  expect(firstSignal?.aborted).toBe(true);
  expect(getSignal()?.aborted).toBe(false);
  unmount();
  expect(getSignal()?.aborted).toBe(true);
});

it("clears completed rankings when the shared connection changes", async () => {
  mockFetch.mockResolvedValue(new Response(JSON.stringify(NATIVE_RESPONSE)));
  const { result } = renderSearch();
  act(() =>
    result.current.settings.update({ apiBase: "https://proxy.example.com/v1" }),
  );
  await act(async () => {
    await result.current.search.mutateAsync(SEARCH);
  });
  await waitFor(() =>
    expect(result.current.search.data?.matches).toHaveLength(1),
  );
  act(() =>
    result.current.settings.update({ apiBase: "https://new.example.com/v1" }),
  );
  await waitFor(() => expect(result.current.search.data).toBeUndefined());
});

it("reports failure and Retry-After without retrying or calling another provider", async () => {
  vi.stubEnv("VITE_OPENAI_API_BASE", "https://proxy.example.com/v1");
  mockFetch.mockResolvedValue(
    new Response(null, { status: 429, headers: { "retry-after": "30" } }),
  );
  const { result } = renderSearch();
  await act(async () => {
    await expect(result.current.search.mutateAsync(SEARCH)).rejects.toThrow(
      "Jev rate limit reached (HTTP 429). Retry after 30 seconds.",
    );
  });
  await waitFor(() => expect(result.current.search.isError).toBe(true));
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(result.current.search.data).toBeUndefined();
});
