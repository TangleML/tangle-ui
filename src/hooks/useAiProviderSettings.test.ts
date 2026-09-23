import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_PROVIDER_BACKEND_MODEL_STORAGE_KEY,
  AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY,
  AI_PROVIDER_STORAGE_KEY,
  useAiProviderSettings,
} from "./useAiProviderSettings";

const LEGACY_STORAGE_KEY = "tangle.componentSearchV2.config";
const backend = vi.hoisted(() => ({ url: "" }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: backend.url }),
}));

describe("useAiProviderSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    backend.url = "";
    delete window.__TANGLE_AI_MODELS__;
  });

  afterEach(() => {
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  it("returns defaults when nothing is stored", () => {
    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config).toEqual({
      apiBase: "",
      apiKey: "",
      model: "gpt-6-sol",
    });
    expect(result.current.isManuallyConfigured).toBe(false);
    expect(result.current.isConfigured).toBe(false);
  });

  it("uses the Tangle proxy when no provider is stored", () => {
    backend.url = "https://backend.example.com/";

    const { result } = renderHook(() => useAiProviderSettings());

    expect(result.current.config).toEqual({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-6-sol",
      backendAuth: { token: "" },
    });
    expect(result.current.isManuallyConfigured).toBe(false);
    expect(result.current.isConfigured).toBe(true);
  });

  it("reads stored values from localStorage", () => {
    backend.url = "https://backend.example.com";
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
    expect(result.current.isManuallyConfigured).toBe(true);
    expect(result.current.isConfigured).toBe(true);
  });

  it.each([AI_PROVIDER_STORAGE_KEY, LEGACY_STORAGE_KEY])(
    "keeps key-only settings in %s out of backend mode",
    (key) => {
      backend.url = "https://backend.example.com";
      window.localStorage.setItem(
        key,
        JSON.stringify({ apiKey: "custom-key", model: "custom-model" }),
      );
      const { result } = renderHook(() => useAiProviderSettings());
      expect(result.current.isManuallyConfigured).toBe(true);
      expect(result.current.isConfigured).toBe(false);
      expect(result.current.config).toEqual({
        apiBase: "",
        apiKey: "custom-key",
        model: "custom-model",
      });
    },
  );

  it("derives backend credentials at runtime and follows token changes and clearing", () => {
    backend.url = "https://backend.example.com";
    window.localStorage.setItem(
      "jwtToken",
      JSON.stringify({ original_token: "first-token" }),
    );
    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.backendAuth).toEqual({ token: "first-token" });
    expect(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).toBeNull();
    act(() => {
      window.localStorage.setItem(
        "jwtToken",
        JSON.stringify({ original_token: "next-token" }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "jwtToken" }));
    });
    expect(result.current.config.backendAuth).toEqual({ token: "next-token" });
    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(result.current.config.backendAuth).toEqual({ token: "" });
  });

  it("never reads or persists backend auth as manual provider configuration", () => {
    backend.url = "https://backend.example.com";
    window.localStorage.setItem(
      "jwtToken",
      JSON.stringify({ original_token: "login-token" }),
    );
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://custom.example.com/api/experimental/ai/v1",
        apiKey: "custom-key",
        model: "custom-model",
        backendAuth: { token: "stale-token" },
      }),
    );
    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.backendAuth).toBeUndefined();
    act(() => result.current.updateManualConfig({ model: "new-model" }));
    expect(
      JSON.parse(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? ""),
    ).toEqual({
      apiBase: "https://custom.example.com/api/experimental/ai/v1",
      apiKey: "custom-key",
      model: "new-model",
    });
    act(() => result.current.clear());
    expect(result.current.config.apiKey).toBe("");
    expect(result.current.config.backendAuth).toEqual({ token: "login-token" });
    expect(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).toBeNull();
  });

  it("stores the Tangle backend model separately from manual settings", () => {
    backend.url = "https://backend.example.com";
    const { result } = renderHook(() => useAiProviderSettings());

    act(() => {
      result.current.setBackendModel("gpt-4.1");
    });

    expect(result.current.config).toEqual({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-4.1",
      backendAuth: { token: "" },
    });
    expect(result.current.manualConfig).toEqual({
      apiBase: "",
      apiKey: "",
      model: "",
    });
    expect(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(
        window.localStorage.getItem(AI_PROVIDER_BACKEND_MODEL_STORAGE_KEY) ??
          "",
      ),
    ).toBe("gpt-4.1");
  });

  it("allows a manual provider to own model selection without falling back to the backend", () => {
    backend.url = "https://backend.example.com";
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
    expect(result.current.isManuallyConfigured).toBe(true);
    expect(result.current.config.apiBase).toBe("https://api.example.com/v1");
  });

  it("updateManualConfig() writes to the central storage key and merges partial values", () => {
    const { result } = renderHook(() => useAiProviderSettings());

    act(() => {
      result.current.updateManualConfig({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      });
    });

    expect(result.current.config.model).toBe("gpt-4o-mini");
    expect(result.current.isConfigured).toBe(true);

    act(() => {
      result.current.updateManualConfig({ model: "claude-3-5-haiku" });
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

  it("clear() returns to the Tangle proxy", () => {
    backend.url = "https://backend.example.com";
    window.localStorage.setItem(AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY, "true");
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({ apiBase: "https://api.example.com/v1" }),
    );

    const { result } = renderHook(() => useAiProviderSettings());

    act(() => {
      result.current.clear();
    });

    expect(result.current.config.apiBase).toBe(
      "https://backend.example.com/api/experimental/ai/v1",
    );
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isManuallyConfigured).toBe(false);
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
    });
  });

  it("uses the host default without saving a user configuration", () => {
    backend.url = "https://backend.example.com";
    window.__TANGLE_AI_MODELS__ = { defaultModel: "team-default" };
    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.model).toBe("team-default");
    expect(result.current.manualConfig).toEqual({
      apiBase: "",
      apiKey: "",
      model: "",
    });
    expect(window.localStorage.length).toBe(0);
  });

  it("follows changes to the connected backend", () => {
    backend.url = "https://first.example.com";
    const { result, rerender } = renderHook(() => useAiProviderSettings());
    backend.url = "https://second.example.com/prefix/";
    rerender();
    expect(result.current.config.apiBase).toBe(
      "https://second.example.com/prefix/api/experimental/ai/v1",
    );
    expect(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).toBeNull();
    backend.url = "";
    rerender();
    expect(result.current.isConfigured).toBe(false);
    expect(result.current.config.backendAuth).toBeUndefined();
  });

  it("preserves independent backend and manual models across reloads", () => {
    backend.url = "https://backend.example.com";
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://custom.example.com/v1",
        apiKey: "custom-secret",
        model: "gpt-4.1",
      }),
    );
    const { result, unmount } = renderHook(() => useAiProviderSettings());
    act(() => result.current.setManuallyConfigured(false));
    expect(result.current.config).toEqual({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-6-sol",
      backendAuth: { token: "" },
    });
    act(() => result.current.setBackendModel("gpt-6-astra"));
    expect(result.current.config.model).toBe("gpt-6-astra");
    expect(result.current.manualConfig.model).toBe("gpt-4.1");
    unmount();
    const { result: reloaded } = renderHook(() => useAiProviderSettings());
    expect(reloaded.current.isManuallyConfigured).toBe(false);
    expect(reloaded.current.config.model).toBe("gpt-6-astra");
    act(() => reloaded.current.setManuallyConfigured(true));
    expect(reloaded.current.config).toEqual({
      apiBase: "https://custom.example.com/v1",
      apiKey: "custom-secret",
      model: "gpt-4.1",
    });
  });

  it("does not use the backend when manual mode is explicitly on but incomplete", () => {
    backend.url = "https://backend.example.com";
    window.localStorage.setItem(AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY, "true");
    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.isConfigured).toBe(false);
    expect(result.current.config).toEqual({
      apiBase: "",
      apiKey: "",
      model: "",
    });
  });

  it("reflects settings changes across hook instances and browser tabs", () => {
    backend.url = "https://backend.example.com";
    const first = renderHook(() => useAiProviderSettings());
    const second = renderHook(() => useAiProviderSettings());
    act(() => first.result.current.setBackendModel("gpt-4.1"));
    expect(second.result.current.config.model).toBe("gpt-4.1");
    act(() => {
      window.localStorage.setItem(
        AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY,
        "true",
      );
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY,
        }),
      );
    });
    expect(second.result.current.isManuallyConfigured).toBe(true);
    expect(first.result.current.isConfigured).toBe(false);
  });
});
