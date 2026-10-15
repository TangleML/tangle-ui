export type AiReasoningEffort =
  "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface AiModelCapabilities {
  id: string;
  reasoningEfforts?: AiReasoningEffort[];
}

export interface AiProviderConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  reasoningEffort?: AiReasoningEffort;
  reasoningEffortPreference?: AiReasoningEffort;
  modelCapabilities?: AiModelCapabilities[];
  credentials?: RequestCredentials;
}
