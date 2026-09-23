import { isRecord } from "@/utils/typeGuards";

export interface AiModelOption {
  id: string;
  label?: string;
  description?: string;
}

interface AiModelOptionsConfig {
  // Replaces the built-in suggestions when the host page provides it.
  models?: AiModelOption[];
  // Shown first in blank model inputs.
  defaultModel?: string;
}

const KNOWN_AI_MODEL_LABELS: Record<string, string> = {
  "gpt-5.6-sol": "GPT-5.6 Sol",
  "gpt-6-astra": "GPT-6 Astra",
  "gpt-5.5": "GPT-5.5",
  "gpt-5": "GPT-5",
  "gpt-5-mini": "GPT-5 mini",
  "gpt-4.1": "GPT-4.1",
  "gpt-4.1-mini": "GPT-4.1 mini",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o mini",
};

const BUILT_IN_AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
  },
  {
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
  },
];

const BUILT_IN_DEFAULT_MODEL = "gpt-5.6-sol";

declare global {
  interface Window {
    __TANGLE_AI_MODELS__?: AiModelOptionsConfig;
  }
}

function readModelOption(value: unknown): AiModelOption | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const id = value.id.trim();
  if (!id) return null;

  return {
    id,
    ...(typeof value.label === "string" && value.label.trim()
      ? { label: value.label.trim() }
      : {}),
    ...(typeof value.description === "string" && value.description.trim()
      ? { description: value.description.trim() }
      : {}),
  };
}

function readInjectedModelOptions(): AiModelOptionsConfig | null {
  if (typeof window === "undefined") return null;
  const config = window.__TANGLE_AI_MODELS__;
  if (!isRecord(config)) return null;

  return {
    ...(Array.isArray(config.models)
      ? { models: config.models.map(readModelOption).filter((v) => v !== null) }
      : {}),
    ...(typeof config.defaultModel === "string" && config.defaultModel.trim()
      ? { defaultModel: config.defaultModel.trim() }
      : {}),
  };
}

export function getAiModelOptions(): AiModelOption[] {
  const injected = readInjectedModelOptions();
  return injected?.models && injected.models.length > 0
    ? injected.models
    : BUILT_IN_AI_MODEL_OPTIONS;
}

export function getDefaultAiModelId(): string {
  const injected = readInjectedModelOptions();
  return injected?.defaultModel ?? BUILT_IN_DEFAULT_MODEL;
}

export function getAiModelLabel(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return "Provider default";
  return (
    getAiModelOptions().find((option) => option.id === trimmed)?.label ??
    KNOWN_AI_MODEL_LABELS[trimmed] ??
    trimmed
  );
}
