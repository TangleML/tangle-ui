import type { AiReasoningEffort } from "@/types/aiProvider";
import { isRecord } from "@/utils/typeGuards";

export interface AiModelOption {
  id: string;
  label?: string;
  description?: string;
  reasoningEfforts?: AiReasoningEffort[];
}

interface AiModelConfig extends AiModelOption {
  provider: "openai" | "anthropic";
  minimumOutputTokens?: number;
}

interface AiModelOptionsConfig {
  models?: AiModelOption[];
  defaultModel?: string;
}

export interface AiHeaderConfig {
  include: Record<string, string>;
  exclude: readonly string[];
  rename?: { from: string; to: string; stripPrefix: RegExp };
}

export const AI_CONFIG = {
  defaultModel: "gpt-6-sol",
  embeddingModel: "text-embedding-3-small",
  defaultProvider: "openai" as const,
  defaultReasoningEffort: "high" as const,
  reasoningTokenAllowance: 8192,
  reasoningLevels: [
    { value: "none", label: "None" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "Extra high" },
    { value: "max", label: "Max" },
  ] satisfies { value: AiReasoningEffort; label: string }[],
  providers: {
    openai: {
      apiName: "Responses API",
      apiBaseExample: "https://api.openai.com/v1",
      endpoint: /\/responses(?:\?|$)/,
      reasoningModelPattern: /^(openai:)?(gpt-[56]|o\d)/i,
      requestHeaders: {
        include: {},
        exclude: [],
      },
    },
    anthropic: {
      apiName: "Anthropic Messages API",
      apiBaseExample: "https://api.anthropic.com/v1",
      modelPattern: /(^|[/:])claude[-_]/i,
      directModelPrefix: /^.*[/:](?=claude[-_])/i,
      nativeReasoningPrefix: "tangle-anthropic:",
      defaultMaxOutputTokens: 8192,
      minimumOutputTokenRule: {
        modelPattern:
          /claude-(?:opus|sonnet|fable|mythos)-(?:5(?:[-.]|$)|preview)/i,
        tokens: 4096,
      },
      routes: {
        proxy: {
          match: /\/v1\/responses(?=\?|$)/,
          replacement: "/anthropic/v1/messages",
        },
        direct: {
          match: /\/responses(?=\?|$)/,
          replacement: "/messages",
        },
      },
      requestHeaders: {
        include: {
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        exclude: [
          "content-length",
          "openai-beta",
          "openai-organization",
          "openai-project",
        ],
      },
      directHeaders: {
        include: { "anthropic-dangerous-direct-browser-access": "true" },
        exclude: ["authorization"],
        rename: {
          from: "authorization",
          to: "x-api-key",
          stripPrefix: /^Bearer\s+/i,
        },
      },
      responseHeaders: {
        include: { "content-type": "application/json" },
        exclude: ["content-length", "content-encoding"],
      },
    },
  },
  models: [
    {
      id: "gpt-6-astra",
      provider: "openai",
      label: "GPT-6 Astra",
      description: "Most capable model for complex reasoning and coding",
      reasoningEfforts: ["low", "medium", "high", "xhigh", "max"],
    },
    {
      id: "gpt-6-sol",
      provider: "openai",
      label: "GPT-6 Sol",
      description: "Balanced model for coding and agentic workflows",
      reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
    },
    {
      id: "gpt-6-luna",
      provider: "openai",
      label: "GPT-6 Luna",
      description: "Fast, efficient model for focused tasks",
      reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
    },
    {
      id: "claude-fable-5-1",
      provider: "anthropic",
      minimumOutputTokens: 4096,
      label: "Claude Fable 5.1",
      description: "For demanding reasoning and long-running agents",
    },
    {
      id: "claude-opus-5-5",
      provider: "anthropic",
      minimumOutputTokens: 4096,
      label: "Claude Opus 5.5",
      description: "For complex coding and agentic workflows",
    },
    {
      id: "claude-sonnet-5-5",
      provider: "anthropic",
      minimumOutputTokens: 4096,
      label: "Claude Sonnet 5.5",
      description: "Balanced speed and intelligence",
    },
    {
      id: "claude-haiku-4-5",
      provider: "anthropic",
      label: "Claude Haiku 4.5",
      description: "Fast model for focused tasks",
    },
  ] satisfies AiModelConfig[],
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

export function getAiProviderConfig(modelId: string) {
  const model = AI_CONFIG.models.find((option) => option.id === modelId);
  if (model) return AI_CONFIG.providers[model.provider];
  return (
    Object.values(AI_CONFIG.providers).find(
      (provider) =>
        "modelPattern" in provider && provider.modelPattern.test(modelId),
    ) ?? AI_CONFIG.providers[AI_CONFIG.defaultProvider]
  );
}

export function getAiMinimumOutputTokens(modelId: string): number {
  const provider = getAiProviderConfig(modelId);
  const id =
    "directModelPrefix" in provider
      ? modelId.replace(provider.directModelPrefix, "")
      : modelId;
  const model =
    AI_CONFIG.models.find((option) => option.id === modelId) ??
    AI_CONFIG.models.find((option) => option.id === id);
  if (model?.minimumOutputTokens !== undefined)
    return model.minimumOutputTokens;
  return "minimumOutputTokenRule" in provider &&
    provider.minimumOutputTokenRule.modelPattern.test(modelId)
    ? provider.minimumOutputTokenRule.tokens
    : 0;
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
  return AI_CONFIG.providers.openai.reasoningModelPattern.test(modelId);
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
