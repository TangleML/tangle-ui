import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_PROVIDER_STORAGE_KEY,
  AI_USE_OWN_KEY_STORAGE_KEY,
  useAiProviderSettings,
} from "./useAiProviderSettings";

const LEGACY_STORAGE_KEY = "tangle.componentSearchV2.config";
const backend = vi.hoisted(() => ({ backendUrl: "" }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

describe("useAiProviderSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    backend.backendUrl = "https://backend.example.com";
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when nothing is stored", () => {
    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config).toEqual({
      apiBase: "",
      apiKey: "",
      model: "gpt-6-sol",
      reasoningEffort: "high",
    });
    expect(result.current.isConfigured).toBe(false);
    expect(result.current.useOwnKey).toBe(true);
  });

  it("uses the selected backend proxy without a personal key and preserves saved settings", () => {
    const customConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-personal",
      model: "gpt-5-mini",
    };
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify(customConfig),
    );
    const { result, unmount } = renderHook(() => useAiProviderSettings());

    act(() => result.current.setUseOwnKey(false));

    expect(result.current.config).toEqual({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-5-mini",
      credentials: "include",
    });
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.customConfig).toEqual(customConfig);
    unmount();

    const reloaded = renderHook(() => useAiProviderSettings());
    expect(reloaded.result.current.useOwnKey).toBe(false);
    act(() => reloaded.result.current.setUseOwnKey(true));
    expect(reloaded.result.current.config).toEqual(customConfig);
  });

  it("uses Sol with High thinking without saved provider details", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config).toEqual({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-6-sol",
      reasoningEffort: "high",
      credentials: "include",
    });
    expect(result.current.isConfigured).toBe(true);
  });

  it("follows backend changes and preserves a backend path prefix", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    const { result, rerender } = renderHook(() => useAiProviderSettings());

    backend.backendUrl = "https://other.example.com/tangle///";
    rerender();

    expect(result.current.config.apiBase).toBe(
      "https://other.example.com/tangle/api/experimental/ai/v1",
    );

    backend.backendUrl = window.location.origin;
    rerender();

    expect(result.current.config.apiBase).toBe(
      `${window.location.origin}/api/experimental/ai/v1`,
    );
  });

  it("requires a selected backend only in proxy mode", () => {
    backend.backendUrl = "";
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config.apiBase).toBe("");
    expect(result.current.isConfigured).toBe(false);

    act(() => {
      result.current.update({ apiBase: "https://api.example.com/v1" });
      result.current.setUseOwnKey(true);
    });

    expect(result.current.isConfigured).toBe(true);
  });

  it("uses the default for a previously cleared model after reloading", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    const { result, unmount } = renderHook(() => useAiProviderSettings());
    act(() => result.current.update({ model: "gpt-5-mini" }));
    act(() => result.current.update({ model: "" }));
    expect(result.current.config.model).toBe("gpt-6-sol");
    unmount();

    const reloaded = renderHook(() => useAiProviderSettings());
    expect(reloaded.result.current.config.model).toBe("gpt-6-sol");
  });

  it("syncs mode changes between mounted consumers and browser tabs", () => {
    const first = renderHook(() => useAiProviderSettings());
    const second = renderHook(() => useAiProviderSettings());
    act(() => first.result.current.setUseOwnKey(false));
    expect(second.result.current.useOwnKey).toBe(false);

    act(() => {
      window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
      window.dispatchEvent(
        new StorageEvent("storage", { key: AI_USE_OWN_KEY_STORAGE_KEY }),
      );
    });
    expect(first.result.current.useOwnKey).toBe(true);
    expect(second.result.current.useOwnKey).toBe(true);
  });

  it("reads stored values from localStorage", () => {
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      }),
    );

    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });
    expect(result.current.isConfigured).toBe(true);
  });

  it("isConfigured only requires apiBase", () => {
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "",
      }),
    );

    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.isConfigured).toBe(true);
  });

  it("update() writes to the central storage key and merges partial values", () => {
    const { result } = renderHook(() => useAiProviderSettings());

    act(() => {
      result.current.update({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      });
    });

    expect(result.current.config.model).toBe("gpt-4o-mini");
    expect(result.current.isConfigured).toBe(true);

    act(() => {
      result.current.update({ model: "claude-3-5-haiku" });
    });

    const storedConfig = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    expect(storedConfig).not.toBeNull();
    const stored = JSON.parse(storedConfig ?? "");
    expect(stored).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "claude-3-5-haiku",
    });
  });

  it("clear() removes central and legacy stored config", () => {
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({ apiBase: "https://api.example.com/v1" }),
    );
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({ apiBase: "https://legacy.example.com/v1" }),
    );

    const { result } = renderHook(() => useAiProviderSettings());

    act(() => {
      result.current.clear();
    });

    expect(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(result.current.isConfigured).toBe(false);
  });

  it("falls back to legacy Components V2 config", () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      }),
    );

    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });
  });

  it("migrates legacy `thinkingModel` into `model` when model is unset", () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        thinkingModel: "gpt-5-mini",
      }),
    );

    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.model).toBe("gpt-5-mini");
  });

  it("falls back to defaults when stored JSON is malformed", () => {
    window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, "not json");

    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config).toEqual({
      apiBase: "",
      apiKey: "",
      model: "gpt-6-sol",
      reasoningEffort: "high",
    });
  });

  it("preserves thinking across model switches, consumers, and reloads", () => {
    const first = renderHook(() => useAiProviderSettings());
    const second = renderHook(() => useAiProviderSettings());
    act(() =>
      first.result.current.update({
        model: "gpt-6-sol",
        reasoningEffort: "none",
      }),
    );
    act(() => first.result.current.update({ model: "gpt-6-astra" }));
    expect(second.result.current.config.reasoningEffort).toBe("low");
    expect(second.result.current.customConfig.reasoningEffort).toBe("none");
    first.unmount();
    second.unmount();

    const reloaded = renderHook(() => useAiProviderSettings());
    act(() => reloaded.result.current.update({ model: "gpt-6-luna" }));
    expect(reloaded.result.current.config.reasoningEffort).toBe("none");

    act(() => {
      window.localStorage.setItem(
        AI_PROVIDER_STORAGE_KEY,
        JSON.stringify({ model: "gpt-6-sol", reasoningEffort: "max" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: AI_PROVIDER_STORAGE_KEY }),
      );
    });
    expect(reloaded.result.current.config.reasoningEffort).toBe("max");
  });

  it("ignores invalid saved thinking levels", () => {
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({ model: "gpt-6-sol", reasoningEffort: "invalid" }),
    );
    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.reasoningEffort).toBe("high");
  });
});
