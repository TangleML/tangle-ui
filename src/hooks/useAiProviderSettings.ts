import { useSyncExternalStore } from "react";

import {
  type AiReasoningEffort,
  DEFAULT_AI_REASONING_EFFORT,
  getDefaultAiModelId,
  isAiReasoningEffort,
} from "@/config/aiModels";
import { useBackend } from "@/providers/BackendProvider";
import type { AiProviderConfig } from "@/types/aiProvider";
import { buildTangleAiProxyBaseUrl } from "@/utils/aiProxy";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

/**
 * Manual API keys are stored in localStorage and readable by JavaScript on
 * this origin. Backend mode never uses these keys.
 */
export const AI_PROVIDER_STORAGE_KEY = "tangle.aiProvider.config";
export const AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY =
  "tangle.aiProvider.manuallyConfigured";
export const AI_PROVIDER_BACKEND_MODEL_STORAGE_KEY =
  "tangle.aiProvider.backendModel";
export const AI_PROVIDER_BACKEND_REASONING_STORAGE_KEY =
  "tangle.aiProvider.backendReasoningEffort";
const LEGACY_COMPONENT_SEARCH_STORAGE_KEY = "tangle.componentSearchV2.config";

type StorageKey =
  | typeof AI_PROVIDER_STORAGE_KEY
  | typeof AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY
  | typeof AI_PROVIDER_BACKEND_MODEL_STORAGE_KEY
  | typeof AI_PROVIDER_BACKEND_REASONING_STORAGE_KEY
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
    config.model.length === 0
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

interface StoredSettings {
  manualConfig: AiProviderConfig;
  backendModel: string;
  backendReasoningEffort: AiReasoningEffort;
  isManuallyConfigured: boolean;
}

const SERVER_SETTINGS: StoredSettings = {
  manualConfig: DEFAULTS,
  backendModel: "",
  backendReasoningEffort: DEFAULT_AI_REASONING_EFFORT,
  isManuallyConfigured: false,
};

function readStoredSettings(): StoredSettings {
  if (typeof window === "undefined") return SERVER_SETTINGS;
  const manualConfig = readStoredConfig();
  const manualFlag = storage.getItem(AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY);
  const storedBackendModel = storage.getItem(
    AI_PROVIDER_BACKEND_MODEL_STORAGE_KEY,
  );
  const storedBackendReasoning = storage.getItem(
    AI_PROVIDER_BACKEND_REASONING_STORAGE_KEY,
  );

  return {
    manualConfig,
    backendModel:
      typeof storedBackendModel === "string" ? storedBackendModel.trim() : "",
    backendReasoningEffort: isAiReasoningEffort(storedBackendReasoning)
      ? storedBackendReasoning
      : DEFAULT_AI_REASONING_EFFORT,
    // Preserve existing custom providers until the user switches them off.
    isManuallyConfigured:
      typeof manualFlag === "boolean"
        ? manualFlag
        : manualConfig.apiBase.length > 0,
  };
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (
      event.key === AI_PROVIDER_STORAGE_KEY ||
      event.key === AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY ||
      event.key === AI_PROVIDER_BACKEND_MODEL_STORAGE_KEY ||
      event.key === AI_PROVIDER_BACKEND_REASONING_STORAGE_KEY ||
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
let cachedSettings = SERVER_SETTINGS;
function getSnapshot(): StoredSettings {
  const fresh = readStoredSettings();
  const json = JSON.stringify(fresh);
  if (json !== cachedJSON) {
    cachedJSON = json;
    cachedSettings = fresh;
  }
  return cachedSettings;
}

function getServerSnapshot(): StoredSettings {
  return SERVER_SETTINGS;
}

export function useAiProviderSettings() {
  const { backendUrl } = useBackend();
  const {
    manualConfig,
    backendModel,
    backendReasoningEffort,
    isManuallyConfigured,
  } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const config: AiProviderConfig = isManuallyConfigured
    ? manualConfig
    : {
        apiBase: buildTangleAiProxyBaseUrl(backendUrl),
        apiKey: "",
        model: backendModel || getDefaultAiModelId(),
        reasoningEffort: backendReasoningEffort,
      };

  // Read fresh from storage instead of merging onto the render-time `config`
  // so two updates in the same tick (e.g. two field handlers firing back-to-
  // back, or an update racing a cross-tab storage event) don't both clobber
  // each other with the same stale snapshot.
  const updateManualConfig = (partial: Partial<AiProviderConfig>) => {
    if (typeof window === "undefined") return;
    const current = readStoredConfig();
    const next: AiProviderConfig = { ...current, ...partial };
    storage.setItem(AI_PROVIDER_STORAGE_KEY, next);
  };

  const setBackendModel = (model: string) => {
    if (typeof window === "undefined") return;
    storage.setItem(AI_PROVIDER_BACKEND_MODEL_STORAGE_KEY, model.trim());
  };

  const setBackendReasoningEffort = (effort: AiReasoningEffort) => {
    if (typeof window === "undefined") return;
    storage.setItem(AI_PROVIDER_BACKEND_REASONING_STORAGE_KEY, effort);
  };

  const setManuallyConfigured = (enabled: boolean) => {
    if (typeof window === "undefined") return;
    storage.setItem(AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY, enabled);
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    storage.setItem(AI_PROVIDER_STORAGE_KEY, null);
    storage.setItem(LEGACY_COMPONENT_SEARCH_STORAGE_KEY, null);
    storage.setItem(AI_PROVIDER_MANUAL_CONFIG_STORAGE_KEY, false);
  };

  const isConfigured = config.apiBase.length > 0;

  return {
    config,
    manualConfig,
    updateManualConfig,
    setBackendModel,
    setBackendReasoningEffort,
    clear,
    isConfigured,
    isManuallyConfigured,
    setManuallyConfigured,
  };
}
