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
export const AI_PROXY_STORAGE_KEY = "tangle.aiProvider.proxy";
export const AI_USE_OWN_KEY_STORAGE_KEY = "tangle.aiProvider.useOwnKey";
const LEGACY_COMPONENT_SEARCH_STORAGE_KEY = "tangle.componentSearchV2.config";

type StorageKey =
  | typeof AI_PROVIDER_STORAGE_KEY
  | typeof AI_PROXY_STORAGE_KEY
  | typeof AI_USE_OWN_KEY_STORAGE_KEY
  | typeof LEGACY_COMPONENT_SEARCH_STORAGE_KEY;

type AiProviderSettingsStorage = Record<StorageKey, unknown>;

const storage = getStorage<StorageKey, AiProviderSettingsStorage>();

const DEFAULTS: AiProviderConfig = {
  apiBase: "",
  apiKey: "",
  model: "",
};

type ProxySettings = Pick<AiProviderConfig, "model" | "reasoningEffort">;

interface AiProviderSettings {
  customConfig: AiProviderConfig;
  proxyConfig: ProxySettings;
}

const SERVER_SETTINGS: AiProviderSettings = {
  customConfig: DEFAULTS,
  proxyConfig: { model: DEFAULTS.model },
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
  // An explicit blank model must not inherit the legacy thinkingModel.
  return {
    apiBase: readTrimmedString(value, "apiBase") || DEFAULTS.apiBase,
    apiKey: readTrimmedString(value, "apiKey") || DEFAULTS.apiKey,
    model:
      typeof value.model === "string"
        ? readTrimmedString(value, "model")
        : readTrimmedString(value, "thinkingModel"),
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
  // Empty partial records must not shadow legacy settings; an explicit model
  // selection takes precedence even when it selects the provider default.
  const stored = storage.getItem(AI_PROVIDER_STORAGE_KEY);
  const current = parseStoredConfig(stored);
  const hasModelSelection =
    isRecord(stored) && typeof stored.model === "string";
  if (current && (!isAllEmpty(current) || hasModelSelection)) return current;
  return (
    parseStoredConfig(storage.getItem(LEGACY_COMPONENT_SEARCH_STORAGE_KEY)) ??
    current ?? { ...DEFAULTS, model: getDefaultAiModelId() }
  );
}

function readProxySettings(): ProxySettings {
  const stored = storage.getItem(AI_PROXY_STORAGE_KEY);
  return {
    model:
      isRecord(stored) && typeof stored.model === "string"
        ? readTrimmedString(stored, "model")
        : getDefaultAiModelId(),
    ...(isRecord(stored) && isAiReasoningEffort(stored.reasoningEffort)
      ? { reasoningEffort: stored.reasoningEffort }
      : {}),
  };
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (
      event.key === AI_PROVIDER_STORAGE_KEY ||
      event.key === AI_PROXY_STORAGE_KEY ||
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
let cachedConfig: AiProviderSettings | null = null;
function getSnapshot(): AiProviderSettings {
  const fresh = {
    customConfig: readStoredConfig(),
    proxyConfig: readProxySettings(),
  };
  const json = JSON.stringify(fresh);
  if (json !== cachedJSON) {
    cachedJSON = json;
    cachedConfig = fresh;
  }
  return cachedConfig ?? fresh;
}

function getServerSnapshot(): AiProviderSettings {
  return SERVER_SETTINGS;
}

export function useAiProviderSettings() {
  const { backendUrl } = useBackend();
  const backendBase = backendUrl.trim().replace(/\/+$/, "");
  const { customConfig, proxyConfig } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const isOwnKeyEnabled = useSyncExternalStore(
    subscribe,
    () => storage.getItem(AI_USE_OWN_KEY_STORAGE_KEY) !== false,
    () => true,
  );
  const modelPreferences = isOwnKeyEnabled ? customConfig : proxyConfig;
  const model = modelPreferences.model;
  const reasoningEffort = getEffectiveReasoningEffort(
    model,
    modelPreferences.reasoningEffort ?? DEFAULT_AI_REASONING_EFFORT,
  );
  const config: AiProviderConfig = {
    apiBase: isOwnKeyEnabled
      ? customConfig.apiBase
      : backendBase
        ? `${backendBase}/api/experimental/ai/v1`
        : "",
    apiKey: isOwnKeyEnabled ? customConfig.apiKey : "",
    model,
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(isOwnKeyEnabled ? {} : { credentials: "include" }),
  };

  const setOwnKeyEnabled = (enabled: boolean) => {
    storage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, enabled);
  };

  // Read fresh from storage instead of merging onto the render-time `config`
  // so two updates in the same tick (e.g. two field handlers firing back-to-
  // back, or an update racing a cross-tab storage event) don't both clobber
  // each other with the same stale snapshot.
  const update = (partial: Partial<AiProviderConfig>) => {
    if (typeof window === "undefined") return;
    if (storage.getItem(AI_USE_OWN_KEY_STORAGE_KEY) === false) {
      const current = readProxySettings();
      storage.setItem(AI_PROXY_STORAGE_KEY, {
        ...current,
        model: partial.model ?? current.model,
        ...(partial.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: partial.reasoningEffort }),
      });
      return;
    }
    const current = readStoredConfig();
    const next: AiProviderConfig = { ...current, ...partial };
    storage.setItem(AI_PROVIDER_STORAGE_KEY, next);
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    if (storage.getItem(AI_USE_OWN_KEY_STORAGE_KEY) === false) {
      storage.setItem(AI_PROXY_STORAGE_KEY, null);
      return;
    }
    storage.setItem(AI_PROVIDER_STORAGE_KEY, null);
    storage.setItem(LEGACY_COMPONENT_SEARCH_STORAGE_KEY, null);
  };

  const isConfigured = config.apiBase.trim().length > 0;

  return {
    config,
    customConfig,
    proxyConfig,
    modelPreferences,
    isOwnKeyEnabled,
    setOwnKeyEnabled,
    update,
    clear,
    isConfigured,
  };
}
