/**
 * LLM reranker for component search.
 *
 * Takes a small candidate set already pre-filtered by the lexical index (see
 * `componentSearchIndex.ts`) and asks an LLM to:
 *   1. Reorder by best fit to the user's query
 *   2. Write a one-sentence reason per result
 *
 * The LLM is intentionally NOT used for retrieval — that's the lexical index's
 * job. Reranking 20 candidates is fast, cheap, and plays to the LLM's actual
 * strength: judgment over a small, well-defined set.
 */

import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { isRecord } from "@/utils/typeGuards";

/**
 * Compact candidate shape sent to the model. Only the fields that inform
 * judgment: name, description, i/o names. Implementation/command text is
 * already covered by the lexical layer and would just inflate the prompt.
 */
export interface RerankCandidate {
  /** Component digest. Used to round-trip the model's response to references. */
  id: string;
  name: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
}

export interface RerankedMatch {
  id: string;
  /** Model-provided relevance, clamped to [0, 1]. */
  score: number;
  reason: string;
}

export interface RerankResult {
  matches: RerankedMatch[];
  /** Raw model response, kept for debugging. */
  rawContent?: string;
}

export interface ComponentDescriptionResult {
  description: string;
  /** Raw model response, kept for debugging. */
  rawContent?: string;
}

export class NaturalLanguageSearchConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NaturalLanguageSearchConfigError";
  }
}

interface LlmOptions {
  signal?: AbortSignal;
  /** Optional model id. Proxies may supply a default when this is blank. */
  model?: string;
  /** Base URL of an OpenAI-compatible API or proxy. Required. */
  apiBase: string;
  /** Optional bearer token. Proxies may supply their own credentials. */
  apiKey?: string;
}

/**
 * gpt-5 / o-series reasoning models reject `max_tokens` and require
 * `max_completion_tokens` instead. Detect by name prefix and use the
 * appropriate field.
 */
function usesCompletionTokensParam(model: string): boolean {
  return /^(gpt-5|o\d|openai:gpt-5|openai:o\d)/i.test(model);
}

/** Clamp score to [0, 1] and reject NaN so the UI/sort never sees garbage. */
function normalizeScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isValidMatch(parsed: unknown): parsed is RerankedMatch {
  return (
    isRecord(parsed) &&
    typeof parsed.id === "string" &&
    typeof parsed.score === "number" &&
    typeof parsed.reason === "string"
  );
}

function readChatCompletionContent(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return "";

  const [firstChoice] = payload.choices;
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return "";

  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content
    : "";
}

function isMatchArray(value: unknown): value is RerankedMatch[] {
  return Array.isArray(value) && value.every(isValidMatch);
}

/**
 * Project a hydrated `ComponentReference` into the compact shape we send to
 * the model. Returns null when the reference has no usable metadata — those
 * would just waste tokens.
 */
export function componentReferenceToCandidate(
  reference: ComponentReference,
): RerankCandidate | null {
  if (!reference.digest) return null;

  const spec = reference.spec;
  const description = spec?.description?.trim() ?? "";
  const hasUsefulMetadata =
    Boolean(spec?.name) ||
    description.length > 0 ||
    (spec?.inputs?.length ?? 0) > 0 ||
    (spec?.outputs?.length ?? 0) > 0;
  if (!hasUsefulMetadata) return null;

  const inputs = spec?.inputs
    ?.map((i) => i.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
  const outputs = spec?.outputs
    ?.map((o) => o.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);

  return {
    id: reference.digest,
    name: getComponentName(reference),
    description,
    ...(inputs && inputs.length > 0 ? { inputs } : {}),
    ...(outputs && outputs.length > 0 ? { outputs } : {}),
  };
}

function buildRerankSystemPrompt(): string {
  return [
    "You are a reranker for an ML pipeline component search.",
    "The user gives you a natural-language query and a small list of candidate components that were already retrieved by lexical search.",
    "Your job: reorder the candidates by how well they fit the query's intent, and write one short reason per match.",
    "Respond with a single JSON object:",
    '{ "matches": [ { "id": "<candidate id>", "score": <0..1>, "reason": "<one short sentence>" } ] }',
    "Rules:",
    "- Include every candidate that plausibly matches the query intent.",
    "- Drop candidates that are clearly unrelated.",
    '- If none of the candidates fit, return { "matches": [] }.',
    "- Order matches from highest to lowest score.",
    "- Use the exact id strings provided. Do not invent ids.",
    "- Keep each reason under 120 characters.",
  ].join("\n");
}

function buildRerankUserPrompt(
  query: string,
  candidates: RerankCandidate[],
): string {
  // No pretty-printing: indentation adds ~25-30% to the payload for no signal.
  return [
    `Query: ${query}`,
    "",
    "Candidates to rerank:",
    JSON.stringify(candidates),
  ].join("\n");
}

function validateConfig(options: LlmOptions): {
  base: string;
  key: string;
  model: string;
} {
  const base = options.apiBase.trim();
  const key = options.apiKey?.trim() ?? "";
  const model = options.model?.trim() ?? "";
  if (!base) {
    throw new NaturalLanguageSearchConfigError(
      "Configure an API base URL in Settings → Agent Configuration to use AI search.",
    );
  }
  return { base: base.replace(/\/+$/, ""), key, model };
}

/**
 * Rerank lexical candidates against the user's query. Returns an empty result
 * when called with no candidates — callers should fall back to the lexical
 * ordering in that case.
 */
export async function rerankComponentsByNaturalLanguage(
  query: string,
  candidates: RerankCandidate[],
  options: LlmOptions,
): Promise<RerankResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { matches: [] };
  if (candidates.length === 0) return { matches: [] };

  const { base, key, model } = validateConfig(options);

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: options.signal,
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      ...(model ? { model } : {}),
      // gpt-5 / o-series reject temperature overrides entirely; omit for them.
      ...(usesCompletionTokensParam(model) ? {} : { temperature: 0 }),
      // Tiny payload now (≤20 candidates × ~150 chars), so the response is
      // bounded. Reasoning models burn budget on hidden thinking tokens —
      // give them more headroom.
      ...(usesCompletionTokensParam(model)
        ? { max_completion_tokens: 2000 }
        : { max_tokens: 700 }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildRerankSystemPrompt() },
        { role: "user", content: buildRerankUserPrompt(trimmed, candidates) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `AI provider returned ${response.status}: ${detail.slice(0, 200) || response.statusText}`,
    );
  }

  const payload: unknown = await response.json();
  const rawContent = readChatCompletionContent(payload);
  if (!rawContent) {
    throw new Error("AI provider returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `Could not parse LLM response as JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const matchesValue = isRecord(parsed) ? parsed.matches : undefined;
  if (!isMatchArray(matchesValue)) {
    return { matches: [], rawContent };
  }

  // Drop hallucinated ids and clamp scores.
  const validIds = new Set(candidates.map((c) => c.id));
  const matches = matchesValue
    .filter((m) => validIds.has(m.id))
    .map((m) => ({ ...m, score: normalizeScore(m.score) }))
    .sort((a, b) => b.score - a.score);

  return { matches, rawContent };
}

interface ComponentDescriptionInput {
  name: string;
  prefilledDescription: string;
  inputs?: Array<{
    name: string;
    type?: unknown;
    description?: string;
    optional?: boolean;
    default?: unknown;
  }>;
  outputs?: Array<{
    name: string;
    type?: unknown;
    description?: string;
  }>;
  implementation: unknown;
}

function componentReferenceToDescriptionInput(
  reference: ComponentReference,
): ComponentDescriptionInput | null {
  const spec = reference.spec;
  if (!spec) return null;

  return {
    name: getComponentName(reference),
    prefilledDescription: spec.description?.trim() ?? "",
    ...(spec.inputs && spec.inputs.length > 0
      ? {
          inputs: spec.inputs.map((input) => ({
            name: input.name,
            type: input.type,
            description: input.description,
            optional: input.optional,
            default: input.default,
          })),
        }
      : {}),
    ...(spec.outputs && spec.outputs.length > 0
      ? {
          outputs: spec.outputs.map((output) => ({
            name: output.name,
            type: output.type,
            description: output.description,
          })),
        }
      : {}),
    implementation: spec.implementation,
  };
}

function buildDescriptionSystemPrompt(): string {
  return [
    "You explain ML pipeline components for users deciding whether to add a component to a pipeline.",
    "Use only the component spec provided. Do not invent behavior that is not supported by the spec.",
    "Explain exactly what the component does, what it consumes, what it produces, and any important implementation detail visible in the spec.",
    "Respond with a single JSON object:",
    '{ "description": "<2-4 sentence precise explanation>" }',
    "Rules:",
    "- Be specific and concrete.",
    "- If the spec is sparse, say what is known and what is not specified.",
    "- Keep the description under 900 characters.",
  ].join("\n");
}

function buildDescriptionUserPrompt(input: ComponentDescriptionInput): string {
  return ["Component spec summary:", JSON.stringify(input)].join("\n");
}

function readDescription(rawContent: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `Could not parse LLM response as JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  if (!isRecord(parsed)) return "";
  const description = parsed.description;
  return typeof description === "string" ? description.trim() : "";
}

export async function generateComponentAiDescription(
  reference: ComponentReference,
  options: LlmOptions,
): Promise<ComponentDescriptionResult> {
  const input = componentReferenceToDescriptionInput(reference);
  if (!input) {
    throw new Error("Component details are not loaded yet.");
  }

  const { base, key, model } = validateConfig(options);

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: options.signal,
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      ...(model ? { model } : {}),
      ...(usesCompletionTokensParam(model) ? {} : { temperature: 0 }),
      ...(usesCompletionTokensParam(model)
        ? { max_completion_tokens: 2000 }
        : { max_tokens: 900 }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildDescriptionSystemPrompt() },
        { role: "user", content: buildDescriptionUserPrompt(input) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `AI provider returned ${response.status}: ${detail.slice(0, 200) || response.statusText}`,
    );
  }

  const payload: unknown = await response.json();
  const rawContent = readChatCompletionContent(payload);
  if (!rawContent) {
    throw new Error("AI provider returned an empty response");
  }

  const description = readDescription(rawContent);
  if (!description) {
    throw new Error("AI provider returned an empty description");
  }

  return { description, rawContent };
}
