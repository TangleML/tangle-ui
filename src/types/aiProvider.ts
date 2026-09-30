export type AiReasoningEffort =
  "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface AiProviderConfig {
  // OpenAI-compatible API base URL, with no endpoint path such as `/responses`.
  apiBase: string;
  // Leave blank when the proxy owns authentication.
  apiKey: string;
  model: string;
  reasoningEffort?: AiReasoningEffort;
  // Include browser authentication when using a backend-managed provider.
  credentials?: RequestCredentials;
}
