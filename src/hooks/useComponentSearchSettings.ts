import { useSyncExternalStore } from "react";

import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

/**
 * OpenAI-compatible proxy/provider configuration for the Components V2
 * natural-language search. Stored in localStorage so users can bring their own
 * key when a proxy does not supply credentials.
 *
 * SECURITY NOTE: localStorage is per-origin and readable by any JS running on
 * this origin. It is not encrypted. This is the same trust model as every
 * other BYOK web tool when a key is provided — users should generate scoped
 * keys with limited permissions and rotate them if compromised.
 */

const STORAGE_KEY = "tangle.componentSearchV2.config";

interface ComponentSearchSettingsStorage extends Record<
  typeof STORAGE_KEY,
  unknown
> {}

const storage = getStorage<
  typeof STORAGE_KEY,
  ComponentSearchSettingsStorage
>();

export interface ComponentSearchConfig {
  apiBase: string;
  apiKey: string;
  /** Optional model id. Proxies may supply a default when this is blank. */
  model: string;
}

const DEFAULTS: ComponentSearchConfig = {
  apiBase:
    import.meta.env.MODE === "test"
      ? ""
      : (import.meta.env.VITE_LLM_API_BASE ??
        import.meta.env.VITE_OPENAI_API_BASE ??
        ""),
  apiKey: "",
  model:
    import.meta.env.MODE === "test"
      ? ""
      : (import.meta.env.VITE_LLM_MODEL ??
        import.meta.env.VITE_OPENAI_MODEL ??
        ""),
};

function readStoredConfig(): ComponentSearchConfig {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const record = storage.getItem(STORAGE_KEY);
    if (!isRecord(record)) return DEFAULTS;
    const legacyThinking =
      "thinkingModel" in record &&
      typeof record.thinkingModel === "string" &&
      record.thinkingModel.trim().length > 0
        ? record.thinkingModel
        : undefined;
    const storedModel =
      "model" in record && typeof record.model === "string"
        ? record.model
        : undefined;
    // Migration: previous versions stored `thinkingModel`. Prefer the current
    // `model` value when present, including an intentional blank override.
    const model = storedModel ?? legacyThinking ?? DEFAULTS.model;
    return {
      apiBase:
        "apiBase" in record && typeof record.apiBase === "string"
          ? record.apiBase
          : DEFAULTS.apiBase,
      apiKey:
        "apiKey" in record && typeof record.apiKey === "string"
          ? record.apiKey
          : DEFAULTS.apiKey,
      model,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Subscribe to localStorage changes so multiple tabs (and this same tab via
 * `getStorage`) stay in sync.
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * Stable snapshot. We memoize by JSON string so `useSyncExternalStore`'s
 * reference equality check doesn't tear; the JSON form changes if and only
 * if the parsed config changes.
 */
let cachedJSON = "";
let cachedConfig: ComponentSearchConfig | null = null;
function getSnapshot(): ComponentSearchConfig {
  const fresh = readStoredConfig();
  const json = JSON.stringify(fresh);
  if (json !== cachedJSON) {
    cachedJSON = json;
    cachedConfig = fresh;
  }
  return cachedConfig ?? fresh;
}

function getServerSnapshot(): ComponentSearchConfig {
  return DEFAULTS;
}

export function useComponentSearchSettings() {
  const config = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // The React Compiler memoizes these for us; no useCallback needed.
  const update = (partial: Partial<ComponentSearchConfig>) => {
    if (typeof window === "undefined") return;
    const next: ComponentSearchConfig = { ...config, ...partial };
    storage.setItem(STORAGE_KEY, next);
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    storage.setItem(STORAGE_KEY, null);
  };

  const isConfigured = config.apiBase.length > 0;

  return { config, update, clear, isConfigured };
}
