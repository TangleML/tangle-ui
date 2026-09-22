import type { ThinkingLevel } from "@tangent/shared/contracts.ts";
import { THINKING_LEVELS } from "@tangent/shared/contracts.ts";

const PROMPT = "startingPrompt";
const MODEL = "startingModel";
const THINKING_DEPTH = "startingThinkingDepth";

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
export function startingSessionExtraData(
  session: StartingSession,
): Record<string, unknown> {
  return {
    [PROMPT]: session.prompt,
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

/** Anyone may PATCH a project, so every key here may be anything at all. */
export function readStartingSession(
  extraData: Record<string, unknown> | null | undefined,
): StartingSession | undefined {
  const prompt = asText(extraData?.[PROMPT]);
  if (!prompt) return undefined;

  return {
    prompt,
    model: asText(extraData?.[MODEL]),
    thinkingDepth: asThinkingLevel(extraData?.[THINKING_DEPTH]),
  };
}

export function withoutStartingSession(
  extraData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...(extraData ?? {}) };
  delete next[PROMPT];
  delete next[MODEL];
  delete next[THINKING_DEPTH];
  return next;
}
