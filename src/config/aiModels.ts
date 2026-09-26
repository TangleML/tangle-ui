import type { AiReasoningEffort } from "@/types/aiProvider";
import { isRecord } from "@/utils/typeGuards";

export interface AiModelOption {
  id: string;
  label?: string;
  description?: string;
  reasoningEfforts?: AiReasoningEffort[];
}

interface AiModelOptionsConfig {
  models?: AiModelOption[];
  defaultModel?: string;
}

export const DEFAULT_AI_REASONING_EFFORT: AiReasoningEffort = "high";

const AI_REASONING_LEVELS: {
  value: AiReasoningEffort;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
];

const BUILT_IN_AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    description: "Most capable model for complex reasoning and coding",
    reasoningEfforts: ["low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    description: "Balanced model for coding and agentic workflows",
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    description: "Fast, efficient model for focused tasks",
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
  },
];

const BUILT_IN_DEFAULT_MODEL = "gpt-6-sol";

export function isAiReasoningEffort(
  value: unknown,
): value is AiReasoningEffort {
  return AI_REASONING_LEVELS.some((level) => level.value === value);
}

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
    ...(Array.isArray(value.reasoningEfforts)
      ? { reasoningEfforts: value.reasoningEfforts.filter(isAiReasoningEffort) }
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
  const trimmed = modelId.trim() || getDefaultAiModelId();
  return (
    getAiModelOptions().find((option) => option.id === trimmed)?.label ??
    trimmed
  );
}

export function getAiModelReasoningLevels(modelId: string) {
  const id = modelId.trim() || getDefaultAiModelId();
  const model = getAiModelOptions().find((option) => option.id === id);
  return AI_REASONING_LEVELS.filter((level) =>
    model?.reasoningEfforts?.includes(level.value),
  );
}

export function getEffectiveReasoningEffort(
  modelId: string,
  preference: AiReasoningEffort = DEFAULT_AI_REASONING_EFFORT,
): AiReasoningEffort | undefined {
  const levels = getAiModelReasoningLevels(modelId);
  const preferredIndex = AI_REASONING_LEVELS.findIndex(
    (level) => level.value === preference,
  );
  let closest = levels[0]?.value;
  let distance = Infinity;
  for (const level of levels) {
    const index = AI_REASONING_LEVELS.findIndex(
      (candidate) => candidate.value === level.value,
    );
    if (Math.abs(index - preferredIndex) < distance) {
      closest = level.value;
      distance = Math.abs(index - preferredIndex);
    }
  }
  return closest;
}

export function getAiReasoningLabel(effort: AiReasoningEffort): string {
  return (
    AI_REASONING_LEVELS.find((level) => level.value === effort)?.label ?? effort
  );
}
