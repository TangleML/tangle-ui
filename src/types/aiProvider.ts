export type AiReasoningEffort =
  "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface AiModelCapabilities {
  id: string;
  reasoningEfforts?: AiReasoningEffort[];
}

export type AiModelApi = "openai-responses" | "anthropic-messages";

export interface AiModelOption extends AiModelCapabilities {
  label?: string;
  description?: string;
  tangentModelId?: string;
  api?: AiModelApi;
  thinkingLevelMap?: Record<string, AiReasoningEffort | null>;
}

export interface AiProviderConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  reasoningEffort?: AiReasoningEffort;
  reasoningEffortPreference?: AiReasoningEffort;
  modelCapabilities?: AiModelOption[];
  credentials?: RequestCredentials;
}
