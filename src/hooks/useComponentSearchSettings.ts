import { useSyncExternalStore } from "react";

/**
 * Bring-your-own-key configuration for the Components V2 natural-language
 * search. Stored in localStorage so each user holds their own credentials —
 * we ship no shared API key in the bundle.
 *
 * SECURITY NOTE: localStorage is per-origin and readable by any JS running on
 * this origin. It is not encrypted. This is the same trust model as every
 * other BYOK web tool — users should generate scoped keys with limited
 * permissions and rotate them if compromised.
 */

const STORAGE_KEY = "tangle.componentSearchV2.config";

export interface ComponentSearchConfig {
  apiBase: string;
  apiKey: string;
  /** Model id used for AI search reranking (any OpenAI-compatible model). */
  model: string;
}

const DEFAULTS: ComponentSearchConfig = {
  apiBase: "",
  apiKey: "",
  model: "",
};

function readStoredConfig(): ComponentSearchConfig {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const record = parsed;
    const legacyThinking =
      "thinkingModel" in record &&
      typeof record.thinkingModel === "string" &&
      record.thinkingModel.trim().length > 0
        ? record.thinkingModel
        : "";
    const storedModel =
      "model" in record &&
      typeof record.model === "string" &&
      record.model.trim().length > 0
        ? record.model
        : "";
    // Migration: previous reranking used `thinkingModel` when present, even if
    // `model` was also stored. Preserve that precedence for existing users.
    const model = legacyThinking || storedModel || DEFAULTS.model;
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
 * Subscribe to localStorage changes so multiple tabs (or the settings page +
 * the search page in the same tab via the manual dispatchEvent below) stay
 * in sync.
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) callback();
  };
  const localHandler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener("tangle:component-search-config", localHandler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("tangle:component-search-config", localHandler);
  };
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Notify same-tab subscribers (the `storage` event only fires across tabs).
    window.dispatchEvent(new Event("tangle:component-search-config"));
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("tangle:component-search-config"));
  };

  const isConfigured =
    config.apiBase.length > 0 &&
    config.apiKey.length > 0 &&
    config.model.length > 0;

  return { config, update, clear, isConfigured };
}
