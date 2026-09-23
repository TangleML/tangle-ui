export const AI_REASONING_EFFORTS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
  { value: "max", label: "Max" },
] as const;

export type AiReasoningEffort = (typeof AI_REASONING_EFFORTS)[number]["value"];

export interface AiModelSelection {
  model: string;
  reasoningEffort: AiReasoningEffort;
}

export const DEFAULT_AI_REASONING_EFFORT: AiReasoningEffort = "high";

const AI_MODEL_OPTIONS = [
  { id: "gpt-6-astra", label: "GPT-6 Astra" },
  { id: "gpt-6-sol", label: "GPT-6 Sol" },
  { id: "gpt-6-luna", label: "GPT-6 Luna" },
];

const KNOWN_AI_MODEL_LABELS: Record<string, string> = {
  "gpt-5.6-sol": "GPT-5.6 Sol",
  "gpt-5.5": "GPT-5.5",
  "gpt-5": "GPT-5",
  "gpt-5-mini": "GPT-5 mini",
  "gpt-4.1": "GPT-4.1",
  "gpt-4.1-mini": "GPT-4.1 mini",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o mini",
};

export function getAiModelOptions() {
  return AI_MODEL_OPTIONS;
}

export function getDefaultAiModelId(): string {
  return "gpt-6-sol";
}

export function isAiReasoningEffort(
  value: unknown,
): value is AiReasoningEffort {
  return AI_REASONING_EFFORTS.some((option) => option.value === value);
}

export function getAiReasoningConfig(
  model: string,
  effort = DEFAULT_AI_REASONING_EFFORT,
): { effort: AiReasoningEffort } | undefined {
  // Do not send OpenAI-specific settings to an unknown manual model/provider.
  return AI_MODEL_OPTIONS.some((option) => option.id === model.trim())
    ? { effort }
    : undefined;
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
