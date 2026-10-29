import type { ThinkingLevel } from "@tangent/shared/contracts.ts";
import { THINKING_LEVELS } from "@tangent/shared/contracts.ts";

import {
  AI_CONFIG,
  getAiModelOptions,
  getAiProviderConfig,
  getEffectiveReasoningEffort,
  isAiReasoningEffort,
} from "@/config/aiConfig";
import type { AiProviderConfig } from "@/types/aiProvider";
import { HOURS } from "@/utils/constants";

const PROMPT = "startingPrompt";
const MODEL = "startingModel";
const THINKING_DEPTH = "startingThinkingDepth";
const REQUESTED_AT = "startingRequestedAt";

const STARTING_SESSION_LIFETIME = 1 * HOURS;

const toReasoningEffort = (level: ThinkingLevel): string =>
  level === "off" ? "none" : level;

export const STARTING_SESSION_REASONING_EFFORTS =
  THINKING_LEVELS.map(toReasoningEffort).filter(isAiReasoningEffort);

export interface StartingSession {
  prompt: string;
  model?: string;
  thinkingDepth?: ThinkingLevel;
}

/**
 * A session cannot be started from outside Tangent, so a page that wants one
 * writes what to run onto the project and Tangent picks it up on arrival. Both
 * ends read these keys through here so neither can drift into its own spelling.
 */
export function startingSessionMetadata(
  session: StartingSession,
): Record<string, unknown> {
  return {
    [PROMPT]: session.prompt,
    [REQUESTED_AT]: new Date().toISOString(),
    ...(session.model ? { [MODEL]: session.model } : {}),
    ...(session.thinkingDepth
      ? { [THINKING_DEPTH]: session.thinkingDepth }
      : {}),
  };
}

const asText = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const asThinkingLevel = (value: unknown) =>
  THINKING_LEVELS.find((level) => level === value);

export function getStartingSessionThinkingDepth(
  config: Pick<
    AiProviderConfig,
    "model" | "reasoningEffortPreference" | "modelCapabilities"
  >,
): ThinkingLevel | undefined {
  const effort = getEffectiveReasoningEffort(
    config.model,
    config.reasoningEffortPreference,
    config.modelCapabilities,
    STARTING_SESSION_REASONING_EFFORTS,
  );
  return THINKING_LEVELS.find((level) => toReasoningEffort(level) === effort);
}

// Tangent runs sessions through its own proxy rather than the user's provider,
// so a model typed in for that provider is left for Tangent to choose.
export function getStartingSessionModel(
  config: Pick<AiProviderConfig, "model" | "modelCapabilities">,
): string | undefined {
  const isCatalogModel = (config.modelCapabilities ?? getAiModelOptions()).some(
    (option) => option.id === config.model,
  );
  if (!isCatalogModel) return undefined;
  const provider =
    getAiProviderConfig(config.model) === AI_CONFIG.providers.anthropic
      ? "anthropic"
      : "openai";
  return `${provider}/${config.model}`;
}

function isStillWanted(requestedAt: unknown) {
  const time = typeof requestedAt === "string" ? Date.parse(requestedAt) : NaN;
  return Date.now() - time < STARTING_SESSION_LIFETIME;
}

/** Anyone may PATCH a project, so every key here may be anything at all. */
export function readStartingSession(
  metadata: Record<string, unknown> | null | undefined,
): StartingSession | undefined {
  const prompt = asText(metadata?.[PROMPT]);
  if (!prompt || !isStillWanted(metadata?.[REQUESTED_AT])) return undefined;

  return {
    prompt,
    model: asText(metadata?.[MODEL]),
    thinkingDepth: asThinkingLevel(metadata?.[THINKING_DEPTH]),
  };
}

export function withoutStartingSession(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  delete next[PROMPT];
  delete next[MODEL];
  delete next[THINKING_DEPTH];
  delete next[REQUESTED_AT];
  return next;
}
