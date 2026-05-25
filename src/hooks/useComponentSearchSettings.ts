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
  /** Fast / default model. */
  model: string;
  /** Better-quality model used when the "Thinking" toggle is on. */
  thinkingModel: string;
}

const DEFAULTS: ComponentSearchConfig = {
  apiBase: "",
  apiKey: "",
  model: "gemini-2.5-flash-lite",
  thinkingModel: "gpt-5-mini",
};

function readStoredConfig(): ComponentSearchConfig {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const p = parsed as Partial<ComponentSearchConfig>;
    return {
      apiBase: typeof p.apiBase === "string" ? p.apiBase : DEFAULTS.apiBase,
      apiKey: typeof p.apiKey === "string" ? p.apiKey : DEFAULTS.apiKey,
      model:
        typeof p.model === "string" && p.model.trim().length > 0
          ? p.model
          : DEFAULTS.model,
      thinkingModel:
        typeof p.thinkingModel === "string" && p.thinkingModel.trim().length > 0
          ? p.thinkingModel
          : DEFAULTS.thinkingModel,
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

  const isConfigured = config.apiBase.length > 0 && config.apiKey.length > 0;

  return { config, update, clear, isConfigured };
}
