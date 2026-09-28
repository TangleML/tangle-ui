import { useSyncExternalStore } from "react";

import {
  DEFAULT_AI_REASONING_EFFORT,
  getDefaultAiModelId,
  getEffectiveReasoningEffort,
  isAiReasoningEffort,
} from "@/config/aiModels";
import { useBackend } from "@/providers/BackendProvider";
import type { AiProviderConfig } from "@/types/aiProvider";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

/**
 * Provider selection shared by all AI features. Turning off bring-your-own-key
 * mode uses the selected backend without overwriting the saved custom provider.
 *
 * Stored in localStorage so each user owns their credentials. API keys stored
 * in localStorage are readable by JavaScript on this origin; users should use
 * scoped keys and rotate them if needed.
 */
export const AI_PROVIDER_STORAGE_KEY = "tangle.aiProvider.config";
export const AI_USE_OWN_KEY_STORAGE_KEY = "tangle.aiProvider.useOwnKey";
const LEGACY_COMPONENT_SEARCH_STORAGE_KEY = "tangle.componentSearchV2.config";

type StorageKey =
  | typeof AI_PROVIDER_STORAGE_KEY
  | typeof AI_USE_OWN_KEY_STORAGE_KEY
  | typeof LEGACY_COMPONENT_SEARCH_STORAGE_KEY;

type AiProviderSettingsStorage = Record<StorageKey, unknown>;

const storage = getStorage<StorageKey, AiProviderSettingsStorage>();

const DEFAULTS: AiProviderConfig = {
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

function parseStoredConfig(value: unknown): AiProviderConfig | null {
  if (!isRecord(value)) return null;
  return {
    apiBase: readTrimmedString(value, "apiBase") || DEFAULTS.apiBase,
    apiKey: readTrimmedString(value, "apiKey") || DEFAULTS.apiKey,
    // Migration: previous Components V2 builds stored `thinkingModel`.
    model:
      readTrimmedString(value, "model") ||
      readTrimmedString(value, "thinkingModel") ||
      DEFAULTS.model,
    ...(isAiReasoningEffort(value.reasoningEffort)
      ? { reasoningEffort: value.reasoningEffort }
      : {}),
  };
}

function isAllEmpty(config: AiProviderConfig): boolean {
  return (
    config.apiBase.length === 0 &&
    config.apiKey.length === 0 &&
    config.model.length === 0 &&
    config.reasoningEffort === undefined
  );
}

function readStoredConfig(): AiProviderConfig {
  if (typeof window === "undefined") return DEFAULTS;
  // Treat an all-empty central record as "absent" so a partial save (e.g. a
  // blanked-out apiBase) doesn't shadow a working legacy config from before
  // this hook was renamed.
  const current = parseStoredConfig(storage.getItem(AI_PROVIDER_STORAGE_KEY));
  if (current && !isAllEmpty(current)) return current;
  return (
    parseStoredConfig(storage.getItem(LEGACY_COMPONENT_SEARCH_STORAGE_KEY)) ??
    current ??
    DEFAULTS
  );
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (
      event.key === AI_PROVIDER_STORAGE_KEY ||
      event.key === AI_USE_OWN_KEY_STORAGE_KEY ||
      event.key === LEGACY_COMPONENT_SEARCH_STORAGE_KEY ||
      event.key === null
    ) {
      callback();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

let cachedJSON = "";
let cachedConfig: AiProviderConfig | null = null;
function getSnapshot(): AiProviderConfig {
  const fresh = readStoredConfig();
  const json = JSON.stringify(fresh);
  if (json !== cachedJSON) {
    cachedJSON = json;
    cachedConfig = fresh;
  }
  return cachedConfig ?? fresh;
}

function getServerSnapshot(): AiProviderConfig {
  return DEFAULTS;
}

export function useAiProviderSettings() {
  const { backendUrl } = useBackend();
  const backendBase = backendUrl.trim().replace(/\/+$/, "");
  const customConfig = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const useOwnKey = useSyncExternalStore(
    subscribe,
    () => storage.getItem(AI_USE_OWN_KEY_STORAGE_KEY) !== false,
    () => true,
  );
  const model = customConfig.model || getDefaultAiModelId();
  const reasoningEffort = getEffectiveReasoningEffort(
    model,
    customConfig.reasoningEffort ?? DEFAULT_AI_REASONING_EFFORT,
  );
  const config: AiProviderConfig = {
    apiBase: useOwnKey
      ? customConfig.apiBase
      : backendBase
        ? `${backendBase}/api/experimental/ai/v1`
        : "",
    apiKey: useOwnKey ? customConfig.apiKey : "",
    model,
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(useOwnKey ? {} : { credentials: "include" }),
  };

  const setUseOwnKey = (enabled: boolean) => {
    storage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, enabled);
  };

  // Read fresh from storage instead of merging onto the render-time `config`
  // so two updates in the same tick (e.g. two field handlers firing back-to-
  // back, or an update racing a cross-tab storage event) don't both clobber
  // each other with the same stale snapshot.
  const update = (partial: Partial<AiProviderConfig>) => {
    if (typeof window === "undefined") return;
    const current = readStoredConfig();
    const next: AiProviderConfig = { ...current, ...partial };
    storage.setItem(AI_PROVIDER_STORAGE_KEY, next);
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    storage.setItem(AI_PROVIDER_STORAGE_KEY, null);
    storage.setItem(LEGACY_COMPONENT_SEARCH_STORAGE_KEY, null);
  };

  const isConfigured = config.apiBase.trim().length > 0;

  return {
    config,
    customConfig,
    useOwnKey,
    setUseOwnKey,
    update,
    clear,
    isConfigured,
  };
}
