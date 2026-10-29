import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_PROVIDER_STORAGE_KEY,
  AI_PROXY_STORAGE_KEY,
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

    expect(result.current.config).toMatchObject({
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

    expect(result.current.config).toMatchObject({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-6-astra",
      reasoningEffort: "high",
      credentials: "include",
    });
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.customConfig).toEqual(customConfig);
    unmount();

    const reloaded = renderHook(() => useAiProviderSettings());
    expect(reloaded.result.current.isOwnKeyEnabled).toBe(false);
    act(() => reloaded.result.current.setOwnKeyEnabled(true));
    expect(reloaded.result.current.config).toMatchObject(customConfig);
  });

  it("keeps proxy and personal models independent across switches and reloads", () => {
    const personal = {
      apiBase: "https://gateway.example.com/v1",
      apiKey: "personal-key",
      model: "gateway/custom-model",
    };
    window.localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify(personal),
    );
    const first = renderHook(() => useAiProviderSettings());
    const second = renderHook(() => useAiProviderSettings());

    act(() => {
      first.result.current.setOwnKeyEnabled(false);
      first.result.current.update({
        model: "proxy-model",
        apiKey: "ignored-key",
      });
    });
    expect(second.result.current.config.model).toBe("proxy-model");
    expect(
      JSON.parse(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? ""),
    ).toEqual(personal);
    expect(
      JSON.parse(window.localStorage.getItem(AI_PROXY_STORAGE_KEY) ?? ""),
    ).toEqual({ model: "proxy-model" });
    act(() => first.result.current.setOwnKeyEnabled(true));
    expect(first.result.current.config).toMatchObject(personal);
    first.unmount();
    second.unmount();

    const reloaded = renderHook(() => useAiProviderSettings());
    act(() => reloaded.result.current.setOwnKeyEnabled(false));
    expect(reloaded.result.current.config.model).toBe("proxy-model");
    act(() => reloaded.result.current.clear());
    expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? ""),
    ).toEqual(personal);
  });

  it("syncs proxy model changes from another tab without changing the personal model", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
    const { result } = renderHook(() => useAiProviderSettings());
    act(() => {
      result.current.update({ model: "personal-model" });
      result.current.setOwnKeyEnabled(false);
      window.localStorage.setItem(
        AI_PROXY_STORAGE_KEY,
        JSON.stringify({ model: "proxy-model" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: AI_PROXY_STORAGE_KEY }),
      );
    });
    expect(result.current.config.model).toBe("proxy-model");
    act(() => result.current.setOwnKeyEnabled(true));
    expect(result.current.config.model).toBe("personal-model");
  });

  it.each([undefined, "false", "null", '"true"', "not json"])(
    "uses the proxy unless the stored own-key flag is boolean true (%s)",
    (storedFlag) => {
      if (storedFlag !== undefined) {
        window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, storedFlag);
      }
      const personal = {
        apiBase: "https://provider.example.com/v1",
        apiKey: "personal-key",
        model: "personal-model",
      };
      window.localStorage.setItem(
        AI_PROVIDER_STORAGE_KEY,
        JSON.stringify(personal),
      );
      window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(personal));
      const { result } = renderHook(() => useAiProviderSettings());

      expect(result.current.isOwnKeyEnabled).toBe(false);
      expect(result.current.config.apiBase).toBe(
        "https://backend.example.com/api/experimental/ai/v1",
      );

      act(() => {
        result.current.update({
          apiBase: "https://ignored.example.com/v1",
          apiKey: "ignored-key",
          model: "proxy-model",
          reasoningEffortPreference: "max",
        });
      });
      expect(result.current.config.model).toBe("proxy-model");
      expect(
        JSON.parse(window.localStorage.getItem(AI_PROXY_STORAGE_KEY) ?? ""),
      ).toEqual({ model: "proxy-model", reasoningEffortPreference: "max" });

      act(() => result.current.clear());
      expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();
      for (const key of [AI_PROVIDER_STORAGE_KEY, LEGACY_STORAGE_KEY]) {
        expect(JSON.parse(window.localStorage.getItem(key) ?? "")).toEqual(
          personal,
        );
      }
    },
  );

  it("preserves an explicitly enabled own-key mode after reloading", () => {
    const { result } = renderHook(() => useAiProviderSettings());
    act(() => result.current.setOwnKeyEnabled(true));
    const reloaded = renderHook(() => useAiProviderSettings());

    expect(reloaded.result.current.isOwnKeyEnabled).toBe(true);
    expect(reloaded.result.current.config).toMatchObject({
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
      result.current.setOwnKeyEnabled(true);
      result.current.update({ apiBase: "https://api.example.com/v1" });
    });

    expect(result.current.isConfigured).toBe(true);
  });

  it.each([true, false])(
    "resolves a blank model to the first catalog model after reloading (own key: %s)",
    (ownKeyEnabled) => {
      window.localStorage.setItem(
        AI_USE_OWN_KEY_STORAGE_KEY,
        JSON.stringify(ownKeyEnabled),
      );
      const { result, unmount } = renderHook(() => useAiProviderSettings());
      act(() => result.current.update({ model: "gpt-5-mini" }));
      act(() => result.current.update({ model: "" }));
      expect(result.current.config.model).toBe("gpt-6-astra");
      expect(result.current.config.reasoningEffort).toBe("high");
      unmount();

      const reloaded = renderHook(() => useAiProviderSettings());
      expect(reloaded.result.current.config.model).toBe("gpt-6-astra");
      expect(reloaded.result.current.config.reasoningEffort).toBe("high");
    },
  );

  it("resolves an explicitly blank model without restoring a legacy model", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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
      window.localStorage.setItem(
        AI_PROXY_STORAGE_KEY,
        JSON.stringify(storedConfig),
      );

      const { result } = renderHook(() => useAiProviderSettings());

      expect(result.current.config.model).toBe("proxy-first");
      expect(result.current.customConfig.model).toBe("proxy-first");
      expect(result.current.proxyConfig.model).toBe("proxy-first");
      expect(result.current.config.reasoningEffort).toBeUndefined();
      act(() => result.current.setOwnKeyEnabled(true));
      expect(result.current.config.model).toBe("proxy-first");
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

    expect(result.current.config).toMatchObject({
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
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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

    expect(result.current.config).toMatchObject({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });
  });

  it("migrates legacy `thinkingModel` into `model` when model is unset", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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

  it.each([
    [false, AI_PROXY_STORAGE_KEY],
    [true, AI_PROVIDER_STORAGE_KEY],
  ])(
    "reads a saved GPT-6 Sol as GPT-6.1 Sol (own key: %s)",
    (ownKeyEnabled, storageKey) => {
      window.localStorage.setItem(
        AI_USE_OWN_KEY_STORAGE_KEY,
        JSON.stringify(ownKeyEnabled),
      );
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          model: "gpt-6-sol",
          reasoningEffortPreference: "none",
        }),
      );

      const { result } = renderHook(() => useAiProviderSettings());

      expect(result.current.config).toMatchObject({
        model: "gpt-6.1-sol",
        reasoningEffortPreference: "none",
        reasoningEffort: "low",
      });
    },
  );

  it("falls back to defaults when stored JSON is malformed", () => {
    window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, "not json");
    window.localStorage.setItem(AI_PROXY_STORAGE_KEY, "not json");

    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config).toMatchObject({
      apiBase: "https://backend.example.com/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-6-astra",
      reasoningEffort: "high",
      credentials: "include",
    });
  });

  it("syncs model and thinking across tabs and mounted consumers", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
    const first = renderHook(() => useAiProviderSettings());
    const second = renderHook(() => useAiProviderSettings());
    act(() => {
      window.localStorage.setItem(
        AI_PROVIDER_STORAGE_KEY,
        JSON.stringify({ model: "gpt-6.1-sol", reasoningEffort: "max" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: AI_PROVIDER_STORAGE_KEY }),
      );
    });
    for (const consumer of [first, second]) {
      expect(consumer.result.current.config.model).toBe("gpt-6.1-sol");
      expect(consumer.result.current.config.reasoningEffort).toBe("max");
    }
  });

  it("ignores invalid saved thinking levels", () => {
    window.localStorage.setItem(
      AI_PROXY_STORAGE_KEY,
      JSON.stringify({ model: "gpt-6.1-sol", reasoningEffort: "invalid" }),
    );
    const { result } = renderHook(() => useAiProviderSettings());
    expect(result.current.config.reasoningEffort).toBe("high");
  });

  it("keeps thinking preferences without applying them to custom models", () => {
    const { result } = renderHook(() => useAiProviderSettings());
    act(() => {
      result.current.update({
        model: "custom-model",
        reasoningEffortPreference: "max",
      });
    });

    expect(result.current.config.reasoningEffort).toBeUndefined();
    expect(result.current.modelPreferences.reasoningEffortPreference).toBe(
      "max",
    );

    act(() => result.current.update({ model: "gpt-6-astra" }));

    expect(result.current.config.reasoningEffort).toBe("max");
  });

  it.each([true, false])(
    "migrates the saved preference without storing effective effort (own key: %s)",
    (ownKeyEnabled) => {
      window.localStorage.setItem(
        AI_USE_OWN_KEY_STORAGE_KEY,
        JSON.stringify(ownKeyEnabled),
      );
      const storageKey = ownKeyEnabled
        ? AI_PROVIDER_STORAGE_KEY
        : AI_PROXY_STORAGE_KEY;
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ model: "gpt-6-astra", reasoningEffort: "none" }),
      );
      const { result } = renderHook(() => useAiProviderSettings());
      expect(result.current.config.reasoningEffort).toBe("low");
      expect(result.current.config.reasoningEffortPreference).toBe("none");

      act(() => result.current.update(result.current.config));
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "");
      expect(saved.reasoningEffortPreference).toBe("none");
      expect(saved).not.toHaveProperty("reasoningEffort");
      expect(saved).not.toHaveProperty("modelCapabilities");
      expect(saved).not.toHaveProperty("credentials");
      act(() => result.current.update({ model: "gpt-6.1-terra" }));
      expect(result.current.config.reasoningEffort).toBe("none");
    },
  );

  it("keeps each mode's thinking preference with its model", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
    const { result } = renderHook(() => useAiProviderSettings());
    act(() =>
      result.current.update({
        model: "gpt-6.1-terra",
        reasoningEffortPreference: "none",
      }),
    );
    act(() => result.current.setOwnKeyEnabled(false));
    expect(result.current.config.reasoningEffortPreference).toBe("high");
    act(() =>
      result.current.update({
        model: "gpt-6-astra",
        reasoningEffortPreference: "max",
      }),
    );
    act(() => result.current.setOwnKeyEnabled(true));
    expect(result.current.config).toMatchObject({
      model: "gpt-6.1-terra",
      reasoningEffort: "none",
    });
    act(() => result.current.setOwnKeyEnabled(false));
    expect(result.current.config).toMatchObject({
      model: "gpt-6-astra",
      reasoningEffort: "max",
    });
  });

  it("includes host capabilities and the original preference in worker configuration", () => {
    window.__TANGLE_AI_MODELS__ = {
      models: [{ id: "host-model", reasoningEfforts: ["low", "max"] }],
    };
    try {
      const { result } = renderHook(() => useAiProviderSettings());
      act(() =>
        result.current.update({
          model: "host-model",
          reasoningEffortPreference: "none",
        }),
      );
      expect(result.current.config).toMatchObject({
        reasoningEffort: "low",
        reasoningEffortPreference: "none",
        modelCapabilities: [
          { id: "host-model", reasoningEfforts: ["low", "max"] },
        ],
      });
    } finally {
      delete window.__TANGLE_AI_MODELS__;
    }
  });
});
