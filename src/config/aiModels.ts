import { isRecord } from "@/utils/typeGuards";

export interface AiModelOption {
  id: string;
  label?: string;
  description?: string;
}

interface AiModelOptionsConfig {
  /** Replaces the built-in model suggestions when provided by the host page. */
  models?: AiModelOption[];
  /** Suggested model shown first in blank model inputs. */
  defaultModel?: string;
}

const BUILT_IN_AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Latest frontier model",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    description: "Frontier model",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    description: "Fast frontier model",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    description: "General-purpose model",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    description: "Fast general-purpose model",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "OpenAI-compatible model",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    description: "Small OpenAI-compatible model",
  },
];

const BUILT_IN_DEFAULT_MODEL = BUILT_IN_AI_MODEL_OPTIONS[0]?.id ?? "gpt-5.5";

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
    trimmed
  );
}
