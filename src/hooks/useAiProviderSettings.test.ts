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
    delete window.__TANGLE_AI_MODELS__;
  });

  it("defaults to the backend proxy and first catalog model when nothing is stored", () => {
    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config).toEqual({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-6-astra",
      reasoningEffort: "high",
      credentials: "include",
    });
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isOwnKeyEnabled).toBe(false);
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
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
    const { result, unmount } = renderHook(() => useAiProviderSettings());

    act(() => result.current.setOwnKeyEnabled(false));

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
    expect(reloaded.result.current.isOwnKeyEnabled).toBe(false);
    act(() => reloaded.result.current.setOwnKeyEnabled(true));
    expect(reloaded.result.current.config).toEqual(customConfig);
  });

  it.each(["false", "null", '"true"', "not json"])(
    "uses the proxy unless the stored own-key flag is boolean true (%s)",
    (storedFlag) => {
      window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, storedFlag);
      const { result } = renderHook(() => useAiProviderSettings());

      expect(result.current.isOwnKeyEnabled).toBe(false);
      expect(result.current.config.apiBase).toBe(
        "https://backend.example.com/api/experimental/ai/v1",
      );
    },
  );

  it("preserves an explicitly enabled own-key mode after reloading", () => {
    const { result } = renderHook(() => useAiProviderSettings());
    act(() => result.current.setOwnKeyEnabled(true));
    const reloaded = renderHook(() => useAiProviderSettings());

    expect(reloaded.result.current.isOwnKeyEnabled).toBe(true);
    expect(reloaded.result.current.config).toEqual({
      apiBase: "",
      apiKey: "",
      model: "gpt-6-astra",
      reasoningEffort: "high",
    });
    expect(reloaded.result.current.isConfigured).toBe(false);
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
      result.current.setOwnKeyEnabled(true);
    });

    expect(result.current.isConfigured).toBe(true);
  });

  it("resolves a blank model to the first catalog model after reloading", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    const { result, unmount } = renderHook(() => useAiProviderSettings());
    act(() => result.current.update({ model: "gpt-5-mini" }));
    act(() => result.current.update({ model: "" }));
    expect(result.current.config.model).toBe("gpt-6-astra");
    expect(result.current.config.reasoningEffort).toBe("high");
    unmount();

    const reloaded = renderHook(() => useAiProviderSettings());
    expect(reloaded.result.current.config.model).toBe("gpt-6-astra");
    expect(reloaded.result.current.config.reasoningEffort).toBe("high");
  });

  it("resolves an explicitly blank model without restoring a legacy model", () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({ model: "legacy-model" }),
    );
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({ model: "", thinkingModel: "legacy-model" }),
    );

    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.model).toBe("gpt-6-astra");
    expect(result.current.config.reasoningEffort).toBe("high");
  });

  it.each([{}, { model: "" }, { model: "   " }])(
    "uses the first host model for an empty saved selection (%j)",
    (storedConfig) => {
      window.__TANGLE_AI_MODELS__ = {
        models: [{ id: "proxy-first" }, { id: "proxy-second" }],
      };
      window.localStorage.setItem(
        AI_PROVIDER_STORAGE_KEY,
        JSON.stringify(storedConfig),
      );

      const { result } = renderHook(() => useAiProviderSettings());

      expect(result.current.config.model).toBe("proxy-first");
      expect(result.current.customConfig.model).toBe("proxy-first");
      expect(result.current.config.reasoningEffort).toBeUndefined();
    },
  );

  it("syncs mode changes between mounted consumers and browser tabs", () => {
    const first = renderHook(() => useAiProviderSettings());
    const second = renderHook(() => useAiProviderSettings());
    act(() => first.result.current.setOwnKeyEnabled(true));
    expect(second.result.current.isOwnKeyEnabled).toBe(true);

    act(() => {
      window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
      window.dispatchEvent(
        new StorageEvent("storage", { key: AI_USE_OWN_KEY_STORAGE_KEY }),
      );
    });
    expect(first.result.current.isOwnKeyEnabled).toBe(false);
    expect(second.result.current.isOwnKeyEnabled).toBe(false);
  });

  it("reads stored values from localStorage", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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
    expect(result.current.config.model).toBe("gpt-6-astra");
    expect(result.current.config.reasoningEffort).toBe("high");
  });

  it("falls back to legacy Components V2 config", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-6-astra",
      reasoningEffort: "high",
      credentials: "include",
    });
  });

  it("syncs model and thinking across tabs and mounted consumers", () => {
    const first = renderHook(() => useAiProviderSettings());
    const second = renderHook(() => useAiProviderSettings());
    act(() => {
      window.localStorage.setItem(
        AI_PROVIDER_STORAGE_KEY,
        JSON.stringify({ model: "gpt-6-sol", reasoningEffort: "max" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: AI_PROVIDER_STORAGE_KEY }),
      );
    });
    for (const consumer of [first, second]) {
      expect(consumer.result.current.config.model).toBe("gpt-6-sol");
      expect(consumer.result.current.config.reasoningEffort).toBe("max");
    }
  });

  it("ignores invalid saved thinking levels", () => {
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({ model: "gpt-6-sol", reasoningEffort: "invalid" }),
    );
    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.reasoningEffort).toBe("high");
  });

  it("keeps thinking preferences without applying them to custom models", () => {
    const { result } = renderHook(() => useAiProviderSettings());
    act(() => {
      result.current.update({ model: "custom-model", reasoningEffort: "max" });
    });

    expect(result.current.config.reasoningEffort).toBeUndefined();
    expect(result.current.customConfig.reasoningEffort).toBe("max");

    act(() => result.current.update({ model: "gpt-6-astra" }));

    expect(result.current.config.reasoningEffort).toBe("max");
  });
});
