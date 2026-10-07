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

export const AI_CONFIG = {
  defaultModel: "gpt-6-sol",
  embeddingModel: "text-embedding-3-small",
  defaultReasoningEffort: "high" as const,
  reasoningTokenAllowance: 8192,
  reasoningModelPattern: /^(openai:)?(gpt-[56]|o\d)/i,
  reasoningLevels: [
    { value: "none", label: "None" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "Extra high" },
    { value: "max", label: "Max" },
  ] satisfies { value: AiReasoningEffort; label: string }[],
  models: [
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
  ] satisfies AiModelOption[],
};

export const DEFAULT_AI_REASONING_EFFORT: AiReasoningEffort =
  AI_CONFIG.defaultReasoningEffort;

export function isAiReasoningEffort(
  value: unknown,
): value is AiReasoningEffort {
  return AI_CONFIG.reasoningLevels.some((level) => level.value === value);
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
    : AI_CONFIG.models;
}

export function getDefaultAiModelId(): string {
  const injected = readInjectedModelOptions();
  return injected?.defaultModel ?? AI_CONFIG.defaultModel;
}

export function getAiModelLabel(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return "Provider default";
  return (
    getAiModelOptions().find((option) => option.id === trimmed)?.label ??
    trimmed
  );
}

export function getAiModelReasoningLevels(modelId: string) {
  const id = modelId.trim();
  if (!id) return [];
  const model = getAiModelOptions().find((option) => option.id === id);
  return AI_CONFIG.reasoningLevels.filter((level) =>
    model?.reasoningEfforts?.includes(level.value),
  );
}

export function getEffectiveReasoningEffort(
  modelId: string,
  preference: AiReasoningEffort = DEFAULT_AI_REASONING_EFFORT,
): AiReasoningEffort | undefined {
  const levels = getAiModelReasoningLevels(modelId);
  const preferredIndex = AI_CONFIG.reasoningLevels.findIndex(
    (level) => level.value === preference,
  );
  const distance = (effort: AiReasoningEffort) =>
    Math.abs(
      AI_CONFIG.reasoningLevels.findIndex((level) => level.value === effort) -
        preferredIndex,
    );
  return levels.sort(
    (left, right) => distance(left.value) - distance(right.value),
  )[0]?.value;
}

export function getAiReasoningLabel(effort: AiReasoningEffort): string {
  return (
    AI_CONFIG.reasoningLevels.find((level) => level.value === effort)?.label ??
    effort
  );
}

export function isAiReasoningModel(modelId: string): boolean {
  return AI_CONFIG.reasoningModelPattern.test(modelId);
}

export function getAiMaxOutputTokens(
  modelId: string,
  reasoningEffort: AiReasoningEffort | undefined,
  outputTokenBudget: number,
): number {
  const model = modelId.trim();
  if (reasoningEffort === "none") return outputTokenBudget;
  if (!model || reasoningEffort || isAiReasoningModel(model)) {
    // Responses counts reasoning tokens against the output limit.
    return outputTokenBudget + AI_CONFIG.reasoningTokenAllowance;
  }
  return outputTokenBudget;
}
