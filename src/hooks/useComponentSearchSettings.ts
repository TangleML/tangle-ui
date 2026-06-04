import { useSyncExternalStore } from "react";

import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

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

type ComponentSearchSettingsStorage = Record<typeof STORAGE_KEY, unknown>;

const storage = getStorage<
  typeof STORAGE_KEY,
  ComponentSearchSettingsStorage
>();

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

function readTrimmedString(
  record: Record<string, unknown>,
  key: string,
): string {
  if (!(key in record)) return "";
  const value = record[key];
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function readStoredConfig(): ComponentSearchConfig {
  if (typeof window === "undefined") return DEFAULTS;
  const record = storage.getItem(STORAGE_KEY);
  if (!isRecord(record)) return DEFAULTS;
  // Migration: previous versions stored `thinkingModel`. Prefer the current
  // `model` value when present, and only fall back to the legacy key.
  const model =
    readTrimmedString(record, "model") ||
    readTrimmedString(record, "thinkingModel") ||
    DEFAULTS.model;
  return {
    apiBase: readTrimmedString(record, "apiBase") || DEFAULTS.apiBase,
    apiKey: readTrimmedString(record, "apiKey") || DEFAULTS.apiKey,
    model,
  };
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
  // Read fresh from storage instead of merging onto the render-time `config`
  // so two updates in the same tick (e.g. two field handlers firing back-to-
  // back, or an update racing a cross-tab storage event) don't both clobber
  // each other with the same stale snapshot.
  const update = (partial: Partial<ComponentSearchConfig>) => {
    if (typeof window === "undefined") return;
    const current = readStoredConfig();
    const next: ComponentSearchConfig = { ...current, ...partial };
    storage.setItem(STORAGE_KEY, next);
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    storage.setItem(STORAGE_KEY, null);
  };

  const isConfigured =
    config.apiBase.length > 0 &&
    config.apiKey.length > 0 &&
    config.model.length > 0;

  return { config, update, clear, isConfigured };
}
