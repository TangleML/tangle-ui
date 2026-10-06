export type AiReasoningEffort =
  "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface AiProviderConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  reasoningEffort?: AiReasoningEffort;
  credentials?: RequestCredentials;
}
