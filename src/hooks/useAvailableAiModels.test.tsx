import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCompatibleAiModelIds } from "@/services/aiModelService";

import { useAvailableAiModels } from "./useAvailableAiModels";

vi.mock("@/services/aiModelService", () => ({
  fetchCompatibleAiModelIds: vi.fn(),
}));

const CONFIG = {
  apiBase: "https://provider.example.com/v1",
  apiKey: "",
  model: "gpt-6-sol",
};

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useAvailableAiModels", () => {
  beforeEach(() => {
    queryClient = new QueryClient();
    vi.mocked(fetchCompatibleAiModelIds).mockReset();
  });

  afterEach(() => {
    queryClient.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  it("loads on demand and limits choices to available curated models", async () => {
    vi.mocked(fetchCompatibleAiModelIds).mockResolvedValue([
      "gpt-6-sol",
      "gpt-6-luna",
      "legacy-model",
    ]);
    const { result, rerender } = renderHook(
      ({ open }) => useAvailableAiModels(CONFIG, open),
      { wrapper, initialProps: { open: false } },
    );
    expect(fetchCompatibleAiModelIds).not.toHaveBeenCalled();
    rerender({ open: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.options.map((model) => model.id)).toEqual([
      "gpt-6-sol",
      "gpt-6-luna",
    ]);
  });

  it("does not reintroduce an unavailable saved model and refreshes when the provider changes", async () => {
    vi.mocked(fetchCompatibleAiModelIds).mockResolvedValue(["gpt-6-luna"]);
    const { result, rerender } = renderHook(
      (config) => useAvailableAiModels(config, true),
      { wrapper, initialProps: CONFIG },
    );
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0].id).toBe("gpt-6-luna");

    vi.mocked(fetchCompatibleAiModelIds).mockResolvedValue(["gpt-6-sol"]);
    rerender({ ...CONFIG, apiBase: "https://other.example.com/v1" });
    await waitFor(() =>
      expect(result.current.options[0]?.id).toBe("gpt-6-sol"),
    );
    expect(result.current.options).toHaveLength(1);
  });

  it("preserves compatible custom models and host catalog restrictions", async () => {
    window.__TANGLE_AI_MODELS__ = { models: [{ id: "host-model" }] };
    vi.mocked(fetchCompatibleAiModelIds).mockResolvedValue([
      "host-model",
      "saved-custom-model",
      "gpt-6-sol",
    ]);
    const { result } = renderHook(
      () =>
        useAvailableAiModels({ ...CONFIG, model: "saved-custom-model" }, true),
      { wrapper },
    );
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.options.map((model) => model.id)).toEqual([
      "saved-custom-model",
      "host-model",
    ]);
  });

  it("refreshes availability when the API key changes at the same endpoint", async () => {
    vi.mocked(fetchCompatibleAiModelIds).mockImplementation(
      async ({ apiKey }) =>
        apiKey === "first-key" ? ["gpt-6-sol"] : ["gpt-6-luna"],
    );
    const { result, rerender } = renderHook(
      (config) => useAvailableAiModels(config, true),
      { wrapper, initialProps: { ...CONFIG, apiKey: "first-key" } },
    );
    await waitFor(() =>
      expect(result.current.options[0]?.id).toBe("gpt-6-sol"),
    );

    rerender({ ...CONFIG, apiKey: "second-key" });

    await waitFor(() =>
      expect(result.current.options[0]?.id).toBe("gpt-6-luna"),
    );
  });

  it("keeps simultaneous catalogs with different credentials separate", async () => {
    vi.mocked(fetchCompatibleAiModelIds).mockImplementation(
      async ({ apiKey }) =>
        apiKey === "first-key" ? ["gpt-6-sol"] : ["gpt-6-luna"],
    );
    const first = renderHook(
      () => useAvailableAiModels({ ...CONFIG, apiKey: "first-key" }, true),
      { wrapper },
    );
    const second = renderHook(
      () => useAvailableAiModels({ ...CONFIG, apiKey: "second-key" }, true),
      { wrapper },
    );

    await waitFor(() => {
      expect(first.result.current.options[0]?.id).toBe("gpt-6-sol");
      expect(second.result.current.options[0]?.id).toBe("gpt-6-luna");
    });
  });

  it("does not offer unchecked choices when discovery fails", async () => {
    vi.mocked(fetchCompatibleAiModelIds).mockRejectedValue(
      new Error("Unavailable"),
    );
    const { result } = renderHook(() => useAvailableAiModels(CONFIG, true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.options).toEqual([]);
  });
});
