import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_PROVIDER_STORAGE_KEY } from "./useAiProviderSettings";
import {
  useComponentAiDescription,
  useNaturalLanguageComponentRerank,
} from "./useNaturalLanguageComponentSearch";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

describe("browser AI request configuration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "jwtToken",
      JSON.stringify({ original_token: "login-token" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({
            matches: [],
            description: "Trains a model.",
          }),
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it.each([false, true])(
    "forwards the runtime connection through search and description hooks (custom: %s)",
    async (custom) => {
      const customBase = `${window.location.origin}/api/experimental/ai/v1`;
      if (custom)
        window.localStorage.setItem(
          AI_PROVIDER_STORAGE_KEY,
          JSON.stringify({
            apiBase: customBase,
            apiKey: "custom-key",
            model: "custom-model",
          }),
        );
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      const { result, unmount } = renderHook(
        () => ({
          search: useNaturalLanguageComponentRerank(),
          description: useComponentAiDescription({
            reference: {
              digest: "example",
              spec: {
                name: "train",
                implementation: { container: { image: "example" } },
              },
            },
            enabled: false,
          }),
        }),
        { wrapper },
      );

      await act(async () => {
        await result.current.search.mutateAsync({
          query: "train",
          candidates: [
            { id: "example", name: "train", description: "Trains a model." },
          ],
        });
        await result.current.description.refetch();
      });

      expect(fetch).toHaveBeenCalledTimes(2);
      for (const [url, init] of vi.mocked(fetch).mock.calls) {
        expect(url).toBe(
          `${custom ? customBase : "https://backend.example.com/api/experimental/ai/v1"}/responses`,
        );
        expect(init?.credentials).toBe(custom ? "omit" : "include");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          custom ? "Bearer custom-key" : "Bearer login-token",
        );
        expect(JSON.parse(String(init?.body)).model).toBe(
          custom ? "custom-model" : "gpt-6-sol",
        );
      }
      expect(vi.mocked(fetch).mock.calls[1]?.[1]?.signal).toBeInstanceOf(
        AbortSignal,
      );
      unmount();
      queryClient.clear();
    },
  );
});
